import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import SignIn from '../screens/SignIn'

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Macro</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', marginTop: 6 }}>loading…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <SignIn />
  }

  return <>{children}</>
}
