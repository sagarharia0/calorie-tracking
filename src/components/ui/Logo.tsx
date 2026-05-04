type Props = { size?: number }

export function Logo({ size = 28 }: Props) {
  return (
    <div className="logo-mark" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      <i style={{ height: '40%' }} />
      <i style={{ height: '70%' }} />
      <i style={{ height: '95%' }} />
    </div>
  )
}
