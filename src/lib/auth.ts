import {
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from './firebase'

// Use redirect (not popup) for sign-in. Popups are unreliable on mobile —
// blocked by default in installed-PWA mode, and on Android Chrome they
// often complete the Google flow without returning the result to the app,
// causing the sign-in screen to loop.
//
// Redirect flow:
//   1. user taps Sign in with Google
//   2. browser navigates to accounts.google.com
//   3. user picks account, grants permission
//   4. Google redirects back to <our-domain>/__/auth/handler then to /
//   5. Firebase SDK detects the redirect, fires onAuthStateChanged with the user
export const signInWithGoogle = () => signInWithRedirect(auth, googleProvider)

// Call once on app boot to surface any error from the redirect (Google denied
// access, network blip mid-flow, etc.). On success the SDK has already updated
// onAuthStateChanged so the caller usually only cares about errors.
export const consumeRedirectResult = () => getRedirectResult(auth)

export const signOutUser = () => signOut(auth)
export const subscribeToAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb)
