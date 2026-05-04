import { sizeBand, type Flag } from '../../lib/flags'

export function SizePill({ kcal }: { kcal: number }) {
  const s = sizeBand(kcal)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 6,
        background: 'var(--surface-3)',
        color: 'var(--ink-2)',
        fontSize: 10,
        fontWeight: 800,
      }}
    >
      {s}
    </span>
  )
}

const FLAG_MAP: Record<Flag, { label: string; bg: string; fg: string }> = {
  cal: { label: 'High cal', bg: 'var(--fat-2)', fg: 'color-mix(in oklch, var(--fat), black 32%)' },
  fat: { label: 'High fat', bg: 'var(--fat-2)', fg: 'color-mix(in oklch, var(--fat), black 32%)' },
  carb: { label: 'High carb', bg: 'var(--carbs-2)', fg: 'color-mix(in oklch, var(--carbs), black 30%)' },
}

export function FlagChip({ flag }: { flag: Flag }) {
  const m = FLAG_MAP[flag]
  return (
    <span
      className="pill"
      style={{
        height: 20,
        fontSize: 10.5,
        fontWeight: 700,
        background: m.bg,
        color: m.fg,
        padding: '0 7px',
      }}
    >
      {m.label}
    </span>
  )
}
