import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth'

export default function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSignIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setBusy(false)
    }
  }

  return (
    <div className="app" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)', marginBottom: 8 }}>
          Macro
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 36, lineHeight: 1.5 }}>
          Personal calorie & macro tracking
        </div>
        <button
          className="btn"
          onClick={onSignIn}
          disabled={busy}
          style={{ width: '100%', cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
