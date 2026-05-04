type Props = {
  c: number
  p: number
  f: number
  total?: number
  height?: number
}

export function StackBar({ c, p, f, total, height = 12 }: Props) {
  const sum = c + p + f
  const denom = total || sum || 1
  return (
    <div className="stackbar" style={{ height }}>
      <span style={{ width: `${(c / denom) * 100}%`, background: 'var(--carbs)' }} />
      <span style={{ width: `${(p / denom) * 100}%`, background: 'var(--protein)' }} />
      <span style={{ width: `${(f / denom) * 100}%`, background: 'var(--fat)' }} />
    </div>
  )
}
