import type { ReactNode } from 'react'

type Props = { children: ReactNode; label?: string }

export function Screen({ children, label }: Props) {
  return (
    <div
      data-screen-label={label}
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {children}
    </div>
  )
}
