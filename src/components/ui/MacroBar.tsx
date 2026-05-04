type MacroVar = 'carbs' | 'protein' | 'fat'

type Props = {
  name: string
  current: number
  goal: number
  varName: MacroVar
}

export function MacroBar({ name, current, goal, varName }: Props) {
  const pct = Math.min(100, (current / goal) * 100)
  return (
    <div className="macro-row">
      <div className="label">
        <div className="row gap-8 aic">
          <span className="swatch" style={{ background: `var(--${varName})` }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>{name}</span>
        </div>
        <div>
          <span className="val tnum">{current}</span>
          <span className="max tnum"> / {goal}g</span>
        </div>
      </div>
      <div className="bar" style={{ color: `var(--${varName})` }}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
