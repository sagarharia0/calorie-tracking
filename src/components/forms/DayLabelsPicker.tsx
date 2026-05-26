import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../ui/Icon'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeToLabels } from '../../lib/repo/labels'
import { ensureDay, setDayLabels } from '../../lib/repo/days'
import type { DateKey, Label, LabelColor } from '../../types/firestore'

const COLORS: Record<LabelColor, { bg: string; fg: string }> = {
  blue: { bg: 'var(--accent-2)', fg: 'var(--accent)' },
  green: { bg: 'var(--protein-2)', fg: 'color-mix(in oklch, var(--protein), black 28%)' },
  amber: { bg: 'var(--fat-2)', fg: 'color-mix(in oklch, var(--fat), black 30%)' },
  rose: { bg: 'oklch(0.94 0.04 15)', fg: 'oklch(0.5 0.16 25)' },
  slate: { bg: 'var(--surface-3)', fg: 'var(--ink-2)' },
}

type Props = {
  dateKey: DateKey
  appliedIds: string[]
  /** Compact mode: smaller pills, no card chrome (for Home). Default false. */
  compact?: boolean
}

// One source of truth for applying/removing labels on any day. Reads the user's
// label library from Firestore and writes back via setDayLabels with an
// ensureDay first so the day doc always exists for the update.
export function DayLabelsPicker({ dateKey, appliedIds, compact = false }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [labels, setLabels] = useState<Label[] | null>(null)
  const [picking, setPicking] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeToLabels(user.uid, setLabels)
  }, [user])

  const active = (labels ?? []).filter((l) => !l.archived)
  const applied = active.filter((l) => appliedIds.includes(l.id))
  const available = active.filter((l) => !appliedIds.includes(l.id))

  const onToggle = async (id: string) => {
    if (!user || pending) return
    setPending(id)
    try {
      await ensureDay(user.uid, dateKey)
      const next = appliedIds.includes(id)
        ? appliedIds.filter((x) => x !== id)
        : [...appliedIds, id]
      await setDayLabels(user.uid, dateKey, next)
    } finally {
      setPending(null)
    }
  }

  // No labels exist yet — point the user to Labels rather than rendering an
  // empty picker. Same destination on both compact and full layouts.
  if (labels !== null && active.length === 0) {
    return (
      <button
        onClick={() => navigate('/labels')}
        className="row gap-6 aic"
        style={{
          border: '1px dashed var(--hairline-2)',
          background: 'transparent',
          padding: compact ? '6px 10px' : '10px 12px',
          borderRadius: 999,
          color: 'var(--ink-3)',
          fontSize: compact ? 11.5 : 12.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Icon name="tag" size={compact ? 12 : 13} color="var(--ink-3)" />
        Create a label first
      </button>
    )
  }

  const chipHeight = compact ? 26 : 30
  const chipFont = compact ? 11.5 : 12.5

  return (
    <div className="col gap-8">
      <div className="row gap-6 aic" style={{ flexWrap: 'wrap' }}>
        {applied.map((l) => (
          <LabelChip
            key={l.id}
            l={l}
            active
            disabled={pending === l.id}
            height={chipHeight}
            fontSize={chipFont}
            onClick={() => onToggle(l.id)}
          />
        ))}
        <button
          onClick={() => setPicking((v) => !v)}
          className="pill"
          style={{
            border: 0,
            background: picking ? 'var(--ink)' : 'var(--surface-2)',
            color: picking ? '#fff' : 'var(--ink-3)',
            height: chipHeight,
            padding: '0 10px',
            fontSize: chipFont,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Icon name={picking ? 'check' : 'plus'} size={12} color={picking ? '#fff' : 'var(--ink-3)'} />
          {applied.length === 0 ? 'Add label' : picking ? 'Done' : ''}
        </button>
      </div>

      {picking && (
        <div
          className="row gap-6 aic"
          style={{
            flexWrap: 'wrap',
            paddingTop: 8,
            borderTop: '1px solid var(--hairline)',
          }}
        >
          {available.length === 0 ? (
            <span className="muted" style={{ fontSize: chipFont, fontWeight: 600 }}>
              All labels applied.
            </span>
          ) : (
            available.map((l) => (
              <LabelChip
                key={l.id}
                l={l}
                disabled={pending === l.id}
                height={chipHeight}
                fontSize={chipFont}
                onClick={() => onToggle(l.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function LabelChip({
  l,
  active,
  onClick,
  disabled,
  height,
  fontSize,
}: {
  l: Label
  active?: boolean
  onClick: () => void
  disabled?: boolean
  height: number
  fontSize: number
}) {
  const c = COLORS[l.color]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pill"
      style={{
        border: 0,
        background: active ? c.bg : 'var(--surface-2)',
        color: active ? c.fg : 'var(--ink-2)',
        height,
        padding: '0 10px',
        fontSize,
        fontWeight: active ? 700 : 600,
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Icon name={l.icon as IconName} size={12} color={active ? c.fg : 'var(--ink-2)'} />
      {l.name}
      {active && <Icon name="check" size={11} color={c.fg} />}
    </button>
  )
}
