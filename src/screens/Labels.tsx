import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { TabBar } from '../components/ui/TabBar'
import { useAuth } from '../contexts/AuthContext'
import { useDay } from '../hooks/useDay'
import { addLabel, archiveLabel, subscribeToLabels } from '../lib/repo/labels'
import { ensureDay, setDayLabels } from '../lib/repo/days'
import { todayKey } from '../lib/dateKey'
import type { Label, LabelColor } from '../types/firestore'

const COLORS: Record<LabelColor, { bg: string; fg: string }> = {
  blue: { bg: 'var(--accent-2)', fg: 'var(--accent)' },
  green: { bg: 'var(--protein-2)', fg: 'color-mix(in oklch, var(--protein), black 28%)' },
  amber: { bg: 'var(--fat-2)', fg: 'color-mix(in oklch, var(--fat), black 30%)' },
  rose: { bg: 'oklch(0.94 0.04 15)', fg: 'oklch(0.5 0.16 25)' },
  slate: { bg: 'var(--surface-3)', fg: 'var(--ink-2)' },
}

const COLOR_VALUES: LabelColor[] = ['blue', 'green', 'amber', 'rose', 'slate']

const ICON_OPTIONS: IconName[] = [
  'briefcase', 'home-s', 'sun', 'moon', 'users', 'plane', 'leaf', 'flame',
]

export default function Labels() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayKey()
  const { day } = useDay(today)

  const [labels, setLabels] = useState<Label[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!user) return
    return subscribeToLabels(user.uid, setLabels)
  }, [user])

  const activeLabels = (labels ?? []).filter((l) => !l.archived)
  const todayLabelIds = day?.labelIds ?? []
  const todayActive = activeLabels.filter((l) => todayLabelIds.includes(l.id))
  const todayInactive = activeLabels.filter((l) => !todayLabelIds.includes(l.id))

  const onToggleToday = async (labelId: string) => {
    if (!user) return
    await ensureDay(user.uid, today)
    const next = todayLabelIds.includes(labelId)
      ? todayLabelIds.filter((id) => id !== labelId)
      : [...todayLabelIds, labelId]
    await setDayLabels(user.uid, today, next)
  }

  const onCreate = async (name: string, icon: IconName, color: LabelColor) => {
    if (!user) return
    await addLabel(user.uid, { name, icon, color })
    setShowCreate(false)
  }

  const onArchive = async (id: string) => {
    if (!user) return
    await archiveLabel(user.uid, id, true)
  }

  return (
    <Screen label="04 Labels">
      <div className="appbar">
        <button
          className="pill"
          onClick={() => navigate(-1)}
          style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Labels</div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="pill"
          style={{
            border: 0,
            height: 32,
            padding: '0 10px',
            background: showCreate ? 'var(--surface-2)' : 'var(--ink)',
            color: showCreate ? 'var(--ink)' : '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Icon name="plus" size={14} color={showCreate ? 'var(--ink)' : '#fff'} />
          {showCreate ? 'Close' : 'New'}
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        {showCreate && (
          <CreateLabelForm onCreate={onCreate} onCancel={() => setShowCreate(false)} />
        )}

        <p className="muted" style={{ fontSize: 13, margin: '4px 4px 14px', lineHeight: 1.45 }}>
          Tag your day to find patterns. Tap a label below to apply it to today.
        </p>

        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Today</div>
          {activeLabels.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
              No labels yet. Tap "New" above to create one.
            </div>
          ) : (
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {todayActive.map((l) => (
                <LabelChip key={l.id} l={l} onClick={() => onToggleToday(l.id)} active />
              ))}
              {todayInactive.map((l) => (
                <LabelChip key={l.id} l={l} onClick={() => onToggleToday(l.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="section-title" style={{ padding: '4px 4px 8px' }}>All labels</div>
        {labels === null ? (
          <div className="muted" style={{ fontSize: 13, padding: '8px 4px' }}>Loading…</div>
        ) : activeLabels.length === 0 ? (
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>No labels yet.</div>
          </div>
        ) : (
          <div className="col gap-10">
            {activeLabels.map((l) => (
              <LabelRow key={l.id} l={l} onArchive={() => onArchive(l.id)} />
            ))}
          </div>
        )}
      </div>

      <TabBar />
    </Screen>
  )
}

function LabelChip({ l, onClick, active }: { l: Label; onClick: () => void; active?: boolean }) {
  const c = COLORS[l.color]
  return (
    <button
      onClick={onClick}
      className="pill"
      style={{
        border: 0,
        background: active ? c.bg : 'var(--surface-2)',
        color: active ? c.fg : 'var(--ink-2)',
        height: 30,
        cursor: 'pointer',
        fontWeight: active ? 700 : 600,
      }}
    >
      <Icon name={l.icon as IconName} size={13} color={active ? c.fg : 'var(--ink-2)'} />
      {l.name}
      {active && <Icon name="check" size={12} color={c.fg} />}
    </button>
  )
}

function LabelRow({ l, onArchive }: { l: Label; onArchive: () => void }) {
  const c = COLORS[l.color]
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row spread aic">
        <div className="row gap-12 aic">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: c.bg,
              color: c.fg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={l.icon as IconName} size={16} />
          </div>
          <div className="col">
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{l.name}</div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 500 }}>
              {l.color}
            </div>
          </div>
        </div>
        <button
          onClick={onArchive}
          className="pill"
          style={{
            border: 0,
            background: 'var(--surface-2)',
            color: 'var(--ink-3)',
            height: 26,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Archive
        </button>
      </div>
    </div>
  )
}

function CreateLabelForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, icon: IconName, color: LabelColor) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<IconName>('briefcase')
  const [color, setColor] = useState<LabelColor>('blue')
  const [saving, setSaving] = useState(false)

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && !saving

  const onSubmit = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onCreate(trimmed, icon, color)
      setName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14, padding: 16 }}>
      <div className="section-title" style={{ marginBottom: 10 }}>New label</div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Label name (e.g. Office)"
        className="input"
        style={{ marginBottom: 14 }}
      />

      <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Icon
      </div>
      <div className="row gap-6" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {ICON_OPTIONS.map((ic) => (
          <button
            key={ic}
            onClick={() => setIcon(ic)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: 0,
              background: icon === ic ? 'var(--ink)' : 'var(--surface-2)',
              color: icon === ic ? '#fff' : 'var(--ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name={ic} size={17} color={icon === ic ? '#fff' : 'var(--ink-2)'} />
          </button>
        ))}
      </div>

      <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Colour
      </div>
      <div className="row gap-6" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {COLOR_VALUES.map((cv) => {
          const c = COLORS[cv]
          const selected = color === cv
          return (
            <button
              key={cv}
              onClick={() => setColor(cv)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: selected ? '2px solid var(--ink)' : '2px solid transparent',
                background: c.bg,
                color: c.fg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {cv[0]}
            </button>
          )
        })}
      </div>

      <div className="row gap-8">
        <button onClick={onCancel} className="btn ghost" style={{ flex: 1, cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSave}
          className="btn"
          style={{ flex: 1, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.6 }}
        >
          {saving ? 'Saving…' : 'Create label'}
        </button>
      </div>
    </div>
  )
}
