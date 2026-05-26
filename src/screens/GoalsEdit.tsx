import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { TabBar } from '../components/ui/TabBar'
import { useAuth } from '../contexts/AuthContext'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { addGoal } from '../lib/repo/goals'
import { todayKey, formatShortDate } from '../lib/dateKey'
import { gramsFromGoal } from '../lib/macros'

type MacroVar = 'carbs' | 'protein' | 'fat'

const PRESETS = [
  { name: 'Balanced', c: 45, p: 30, f: 25 },
  { name: 'High protein', c: 35, p: 40, f: 25 },
  { name: 'Low carb', c: 20, p: 35, f: 45 },
] as const

export default function GoalsEdit() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayKey()
  const { goal: activeGoal } = useActiveGoal(today)

  const [kcal, setKcal] = useState(2200)
  const [carbsPct, setCarbsPct] = useState(45)
  const [proteinPct, setProteinPct] = useState(30)
  const [fatPct, setFatPct] = useState(25)
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Initialise from the active goal (once it loads).
  useEffect(() => {
    if (activeGoal) {
      setKcal(activeGoal.kcal)
      setCarbsPct(activeGoal.carbsPct)
      setProteinPct(activeGoal.proteinPct)
      setFatPct(activeGoal.fatPct)
    }
  }, [activeGoal?.id])

  const totalPct = carbsPct + proteinPct + fatPct
  const validPct = totalPct === 100
  const grams = gramsFromGoal(kcal, carbsPct, proteinPct, fatPct)

  const matchedPreset = PRESETS.find(
    (pr) => pr.c === carbsPct && pr.p === proteinPct && pr.f === fatPct,
  )

  const onSave = async () => {
    if (!user || saving || !validPct) return
    setSaving(true)
    setErr(null)
    try {
      await addGoal(user.uid, { effectiveFrom, kcal, carbsPct, proteinPct, fatPct })
      navigate('/goals')
    } catch (e) {
      setErr(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      setSaving(false)
    }
  }

  return (
    <Screen label="Edit goals">
      <div className="appbar">
        <button
          className="pill"
          onClick={() => navigate('/goals')}
          style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Edit goals</div>
        <button
          onClick={onSave}
          disabled={saving || !validPct}
          className="pill"
          style={{
            border: 0,
            height: 32,
            padding: '0 12px',
            background: 'transparent',
            color: validPct ? 'var(--accent)' : 'var(--ink-4)',
            fontWeight: 700,
            cursor: validPct && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        {err && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              padding: 12,
              background: 'var(--fat-2)',
              color: 'color-mix(in oklch, var(--fat), black 32%)',
              border: 0,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {err}
          </div>
        )}

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Calorie target</div>
          <div className="row spread aib" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {kcal.toLocaleString()}
            </div>
            <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>kcal / day</div>
          </div>
          <div className="stepper">
            <button onClick={() => setKcal(Math.max(1200, kcal - 50))} style={{ cursor: 'pointer' }}>−</button>
            <input
              type="range"
              min={1400}
              max={3500}
              step={50}
              value={kcal}
              onChange={(e) => setKcal(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--ink)' }}
            />
            <button onClick={() => setKcal(Math.min(3500, kcal + 50))} style={{ cursor: 'pointer' }}>+</button>
          </div>
          <div className="row spread" style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
            <span>1,400</span>
            <span>3,500</span>
          </div>
        </div>

        <div className="section-title" style={{ padding: '4px 4px 8px' }}>Presets</div>
        <div className="row gap-8" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          {PRESETS.map((pr) => {
            const active = matchedPreset?.name === pr.name
            return (
              <button
                key={pr.name}
                onClick={() => {
                  setCarbsPct(pr.c)
                  setProteinPct(pr.p)
                  setFatPct(pr.f)
                }}
                style={{
                  border: 0,
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: active ? 'var(--ink)' : '#fff',
                  color: active ? '#fff' : 'var(--ink)',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: active ? 'none' : '0 0 0 1px var(--hairline)',
                  cursor: 'pointer',
                }}
              >
                {pr.name}
              </button>
            )
          })}
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row spread aic" style={{ marginBottom: 12 }}>
            <div className="section-title">Macro split</div>
            <div
              className="tnum"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: validPct
                  ? 'color-mix(in oklch, var(--protein), black 28%)'
                  : 'color-mix(in oklch, var(--fat), black 30%)',
              }}
            >
              {totalPct}% total {validPct ? '✓' : '— must be 100%'}
            </div>
          </div>

          <div className="stackbar" style={{ height: 14, marginBottom: 18 }}>
            <span style={{ width: `${carbsPct}%`, background: 'var(--carbs)' }} />
            <span style={{ width: `${proteinPct}%`, background: 'var(--protein)' }} />
            <span style={{ width: `${fatPct}%`, background: 'var(--fat)' }} />
          </div>

          <MacroSlider name="Carbs" varName="carbs" pct={carbsPct} grams={grams.c_g} kcal={grams.c_g * 4} onChange={setCarbsPct} />
          <div style={{ height: 14 }} />
          <MacroSlider name="Protein" varName="protein" pct={proteinPct} grams={grams.p_g} kcal={grams.p_g * 4} onChange={setProteinPct} />
          <div style={{ height: 14 }} />
          <MacroSlider name="Fat" varName="fat" pct={fatPct} grams={grams.f_g} kcal={grams.f_g * 9} onChange={setFatPct} />
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row spread aic" style={{ marginBottom: 8 }}>
            <div className="col">
              <div style={{ fontWeight: 700, fontSize: 14 }}>Effective from</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>
                Goal applies from this date until a newer goal supersedes it.
              </div>
            </div>
          </div>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="input"
            style={{ marginTop: 8 }}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 6, fontWeight: 600 }}>
            Defaulted to {formatShortDate(today)}.
          </div>
        </div>
      </div>

      <TabBar />
    </Screen>
  )
}

function MacroSlider({
  name,
  varName,
  pct,
  grams,
  kcal,
  onChange,
}: {
  name: string
  varName: MacroVar
  pct: number
  grams: number
  kcal: number
  onChange: (v: number) => void
}) {
  return (
    <div className="col gap-6">
      <div className="row spread aib">
        <div className="row gap-8 aic">
          <span className="swatch" style={{ background: `var(--${varName})` }} />
          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink-2)' }}>{name}</span>
        </div>
        <div className="tnum" style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>{grams}g</span>
          <span className="muted" style={{ fontWeight: 600 }}> · {pct}% · {kcal} kcal</span>
        </div>
      </div>
      <input
        type="range"
        min={5}
        max={80}
        step={1}
        value={pct}
        onChange={(e) => onChange(+e.target.value)}
        style={{ accentColor: `var(--${varName})`, width: '100%' }}
      />
    </div>
  )
}
