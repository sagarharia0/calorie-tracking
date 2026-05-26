import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { TabBar } from '../components/ui/TabBar'
import { useAuth } from '../contexts/AuthContext'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { signOutUser } from '../lib/auth'
import { setDiet } from '../lib/repo/users'
import { todayKey } from '../lib/dateKey'
import type { Diet } from '../types/firestore'

const DIET_OPTIONS: Array<{ value: Diet | undefined; label: string; sub: string }> = [
  { value: undefined,    label: 'None',         sub: 'No restriction' },
  { value: 'vegetarian', label: 'Vegetarian',   sub: 'No meat, poultry, or fish' },
  { value: 'vegan',      label: 'Vegan',        sub: 'No animal products' },
  { value: 'pescatarian',label: 'Pescatarian',  sub: 'Fish OK; no meat or poultry' },
]

export default function Settings() {
  const { user, diet } = useAuth()
  const navigate = useNavigate()
  const today = todayKey()
  const { goal } = useActiveGoal(today)

  return (
    <Screen label="Settings">
      <div className="appbar">
        <div style={{ width: 32 }} />
        <div style={{ fontSize: 16, fontWeight: 700 }}>Settings</div>
        <div style={{ width: 32 }} />
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        <div className="section-title" style={{ padding: '4px 4px 8px' }}>Personalisation</div>

        <Row
          icon="target"
          title="Daily goals"
          subtitle={goal ? `${goal.kcal.toLocaleString()} kcal · ${goal.carbsPct}/${goal.proteinPct}/${goal.fatPct}` : 'Not set'}
          onClick={() => navigate('/goals')}
        />
        <Row
          icon="tag"
          title="Labels"
          subtitle="Tag days with context"
          onClick={() => navigate('/labels')}
        />

        <div className="section-title" style={{ padding: '20px 4px 8px' }}>Dietary preferences</div>
        <DietCard
          uid={user?.uid}
          current={diet}
        />

        <div className="section-title" style={{ padding: '20px 4px 8px' }}>Account</div>

        <div
          className="card"
          style={{
            border: '1px solid var(--hairline)',
            background: 'var(--surface)',
            boxShadow: 'none',
            padding: 14,
          }}
        >
          <div className="row spread aic" style={{ gap: 8 }}>
            <div className="col" style={{ minWidth: 0, flex: 1 }}>
              <div className="muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Signed in as
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink-2)',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email ?? '—'}
              </div>
            </div>
            <button
              onClick={async () => {
                await signOutUser()
                navigate('/')
              }}
              className="pill"
              style={{
                border: 0,
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                height: 32,
                padding: '0 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <TabBar />
    </Screen>
  )
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: IconName
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        border: '1px solid var(--hairline)',
        background: 'var(--surface)',
        boxShadow: 'none',
        padding: 14,
        cursor: 'pointer',
        width: '100%',
        marginBottom: 8,
      }}
    >
      <span className="row gap-12 aic" style={{ minWidth: 0 }}>
        <span
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--surface-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={16} />
        </span>
        <span className="col" style={{ minWidth: 0, alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{title}</span>
          <span className="muted" style={{ fontSize: 11.5, fontWeight: 500, marginTop: 2 }}>
            {subtitle}
          </span>
        </span>
      </span>
      <Icon name="forward" size={16} color="var(--ink-3)" />
    </button>
  )
}

function DietCard({ uid, current }: { uid: string | undefined; current: Diet | undefined }) {
  const [saving, setSaving] = useState<Diet | 'none' | null>(null)

  const onPick = async (value: Diet | undefined) => {
    if (!uid) return
    setSaving(value ?? 'none')
    try {
      await setDiet(uid, value)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--hairline)',
        background: 'var(--surface)',
        boxShadow: 'none',
        padding: 6,
      }}
    >
      {DIET_OPTIONS.map((opt, i) => {
        const active = current === opt.value || (opt.value === undefined && current === undefined)
        const pending = saving === (opt.value ?? 'none')
        return (
          <button
            key={opt.label}
            onClick={() => onPick(opt.value)}
            disabled={!uid || !!saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              width: '100%',
              border: 0,
              background: 'transparent',
              padding: '10px 10px',
              cursor: !uid || saving ? 'wait' : 'pointer',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
              textAlign: 'left',
            }}
          >
            <span className="col" style={{ minWidth: 0, alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{opt.label}</span>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 500, marginTop: 2 }}>
                {opt.sub}
              </span>
            </span>
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                border: `2px solid ${active ? 'var(--accent)' : 'var(--ink-4)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: active ? 'var(--accent)' : 'transparent',
                opacity: pending ? 0.5 : 1,
              }}
            >
              {active && <Icon name="check" size={12} color="#fff" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
