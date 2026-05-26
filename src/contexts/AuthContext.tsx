import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { consumeRedirectResult, subscribeToAuth } from '../lib/auth'
import { ensureUser, subscribeToUser } from '../lib/repo/users'
import type { Diet } from '../types/firestore'

type AuthState = {
  user: User | null
  loading: boolean
  // Set when a recent sign-in redirect failed (popup blocked, Google error,
  // network blip mid-redirect). SignIn surfaces this so the user knows why.
  redirectError: string | null
  // User's dietary preference, mirrored from /users/{uid}.diet. undefined =
  // no restriction. Consumed by the LLM callables to filter suggestions and
  // by the Settings screen to render the picker.
  diet: Diet | undefined
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  redirectError: null,
  diet: undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    redirectError: null,
    diet: undefined,
  })

  useEffect(() => {
    // Process the redirect result on first mount. Resolves to null if there
    // was no redirect; resolves to a UserCredential if sign-in succeeded
    // (onAuthStateChanged will also fire); rejects on error.
    consumeRedirectResult().catch((err) => {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      setState((prev) => ({ ...prev, redirectError: message }))
    })

    return subscribeToAuth((user) =>
      setState((prev) => ({ ...prev, user, loading: false })),
    )
  }, [])

  // When a user signs in, ensure the /users/{uid} doc exists, then subscribe
  // to its `diet` field. Resets to undefined on sign-out.
  useEffect(() => {
    if (!state.user) {
      setState((prev) => (prev.diet === undefined ? prev : { ...prev, diet: undefined }))
      return
    }
    // Fire-and-forget ensureUser. Safe to call on every mount — idempotent.
    ensureUser(state.user).catch(() => {
      // Allowlist-gated users may not have write perms yet on first sign-in
      // (Pending Approval flow). Silent failure is fine — the diet picker
      // is gated behind allowlist anyway.
    })
    const unsub = subscribeToUser(state.user.uid, (doc) => {
      setState((prev) => ({ ...prev, diet: doc?.diet }))
    })
    return unsub
  }, [state.user?.uid])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
