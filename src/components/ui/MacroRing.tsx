type Props = {
  size?: number
  stroke?: number
  c?: number
  p?: number
  f?: number
  kcal?: number
  goal?: number
  future?: boolean
  active?: boolean
}

export function MacroRing({
  size = 38,
  stroke = 4,
  c = 0,
  p = 0,
  f = 0,
  kcal = 0,
  goal = 2200,
  future = false,
  active = false,
}: Props) {
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const totalMacroKcal = c * 4 + p * 4 + f * 9

  if (future || totalMacroKcal === 0) {
    return (
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={active ? 'var(--ink)' : 'var(--hairline-2)'}
          strokeWidth={stroke}
          strokeDasharray="2.5 3.5"
          opacity={future ? 0.55 : 1}
        />
      </svg>
    )
  }

  const fillPct = Math.min(1, kcal / goal)
  const arcLen = circ * fillPct
  const cArc = arcLen * ((c * 4) / totalMacroKcal)
  const pArc = arcLen * ((p * 4) / totalMacroKcal)
  const fArc = arcLen * ((f * 9) / totalMacroKcal)
  const over = kcal > goal

  return (
    <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="var(--carbs)" strokeWidth={stroke} strokeLinecap="butt"
        strokeDasharray={`${cArc} ${circ - cArc}`} strokeDashoffset={0}
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="var(--protein)" strokeWidth={stroke} strokeLinecap="butt"
        strokeDasharray={`${pArc} ${circ - pArc}`} strokeDashoffset={-cArc}
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="var(--fat)" strokeWidth={stroke} strokeLinecap="butt"
        strokeDasharray={`${fArc} ${circ - fArc}`} strokeDashoffset={-(cArc + pArc)}
      />
      {over && (
        <circle
          cx={cx}
          cy={cy - r - stroke / 2 - 1.5}
          r={1.8}
          fill="var(--danger)"
          transform={`rotate(90 ${cx} ${cy})`}
        />
      )}
    </svg>
  )
}
