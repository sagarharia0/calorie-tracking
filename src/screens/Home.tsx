import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/ui/Icon'
import { Logo } from '../components/ui/Logo'
import { MacroBar } from '../components/ui/MacroBar'
import { StackBar } from '../components/ui/StackBar'
import { DayStrip } from '../components/ui/DayStrip'
import { TabBar } from '../components/ui/TabBar'
import { Screen } from '../components/ui/Screen'
import { useDay } from '../hooks/useDay'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { todayKey } from '../lib/dateKey'
import { gramsFromGoal } from '../lib/macros'
import { TODAY_DATA } from '../data/mock'
import type { Meal } from '../types/firestore'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Home() {
  const navigate = useNavigate()
  const today = todayKey()
  const { day, meals, loading } = useDay(today)
  const { goal } = useActiveGoal(today)

  // Goal: derive grams from live Goal (kcal + percentages). Fallback while loading.
  const goalKcal = goal?.kcal ?? 2200
  const goalGrams = goal
    ? gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
    : { c_g: 250, p_g: 160, f_g: 70 }

  // Consumed: live day totals; zeros if day doc absent.
  const consumed = day?.totals ?? { kcal: 0, c_g: 0, p_g: 0, f_g: 0 }

  const remaining = Math.max(0, goalKcal - consumed.kcal)
  const pct = goalKcal > 0 ? Math.round((consumed.kcal / goalKcal) * 100) : 0

  const dateObj = new Date()
  const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  // Day strip: 6 historical mock days + today's live values.
  // Stage 5 keeps history mocked; later stages will fetch a window of real days.
  const liveTodaySlot = {
    dow: DOW[dateObj.getDay()],
    num: dateObj.getDate(),
    kcal: consumed.kcal,
    c: consumed.c_g,
    p: consumed.p_g,
    f: consumed.f_g,
  }
  const weekDays = [...TODAY_DATA.weekDays.slice(0, 6), liveTodaySlot]

  // Macro split percentages (Atwater approximation; harmless drift for mainstream foods)
  const carbsPct = consumed.kcal > 0 ? Math.round(((consumed.c_g * 4) / consumed.kcal) * 100) : 0
  const proteinPct = consumed.kcal > 0 ? Math.round(((consumed.p_g * 4) / consumed.kcal) * 100) : 0
  const fatPct = consumed.kcal > 0 ? Math.round(((consumed.f_g * 9) / consumed.kcal) * 100) : 0

  return (
    <Screen label="01 Home">
      <div className="appbar">
        <div className="row gap-10 aic" style={{ minWidth: 0 }}>
          <Logo size={30} />
          <div className="col" style={{ lineHeight: 1.1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Macro</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{dateStr}</div>
          </div>
        </div>
        <button className="pill" style={{ border: 0, height: 30, flexShrink: 0, cursor: 'pointer' }}>
          <Icon name="calendar" size={14} /> History
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <DayStrip days={weekDays} todayIdx={6} goal={goalKcal} />
        </div>

        <div className="card" style={{ marginBottom: 14, padding: 20 }}>
          <div className="row spread aic" style={{ marginBottom: 14, gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Calories left
            </div>
            <div className="pill" style={{ height: 24, fontSize: 11.5, flexShrink: 0 }}>
              <Icon name="target" size={12} /> {goalKcal.toLocaleString()} goal
            </div>
          </div>
          <div className="row aib" style={{ gap: 14 }}>
            <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {remaining.toLocaleString()}
            </div>
            <div className="col" style={{ alignItems: 'flex-start', gap: 2, paddingBottom: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{consumed.kcal.toLocaleString()} eaten</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{pct}% of goal</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <StackBar c={consumed.c_g * 4} p={consumed.p_g * 4} f={consumed.f_g * 9} total={goalKcal} height={10} />
            <div className="row gap-12" style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>
              <span className="row gap-6 aic"><span className="swatch" style={{ background: 'var(--carbs)' }} />Carbs {carbsPct}%</span>
              <span className="row gap-6 aic"><span className="swatch" style={{ background: 'var(--protein)' }} />Protein {proteinPct}%</span>
              <span className="row gap-6 aic"><span className="swatch" style={{ background: 'var(--fat)' }} />Fat {fatPct}%</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MacroBar name="Carbs" current={consumed.c_g} goal={goalGrams.c_g} varName="carbs" />
          <MacroBar name="Protein" current={consumed.p_g} goal={goalGrams.p_g} varName="protein" />
          <MacroBar name="Fat" current={consumed.f_g} goal={goalGrams.f_g} varName="fat" />
        </div>

        <div className="row spread aic" style={{ marginBottom: 8, padding: '4px 4px' }}>
          <div className="section-title">Today</div>
          <button className="pill" style={{ border: 0, height: 24, fontSize: 11.5, cursor: 'pointer' }}>
            <Icon name="plus" size={12} /> Label day
          </button>
        </div>
        <div className="row gap-6" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: 'var(--accent-2)', color: 'var(--accent)' }}>
            <Icon name="briefcase" size={12} /> Office
          </span>
          <span className="pill" style={{ background: 'var(--surface-2)' }}>
            <Icon name="plus" size={12} /> Add label
          </span>
        </div>

        <div className="row spread aic" style={{ marginBottom: 8, padding: '4px 4px' }}>
          <div className="section-title">Meals</div>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{meals.length} logged</span>
        </div>
        <div className="col gap-10">
          {meals.map((m) => (
            <MealRow key={m.id} m={m} onClick={() => navigate(`/day/${today}`)} />
          ))}
          {!loading && meals.length === 0 && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                No meals logged yet today.<br />
                Tap the + button or scan a barcode to log your first one.
              </div>
            </div>
          )}
          <button
            onClick={() => navigate(`/day/${today}/add`)}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px dashed var(--hairline-2)',
              background: 'transparent',
              boxShadow: 'none',
              cursor: 'pointer',
            }}
          >
            <span className="row gap-10 aic" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>
              <Icon name="plus" size={16} /> Log a meal
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>OPTIONAL</span>
          </button>
        </div>
      </div>

      <button
        className="fab"
        aria-label="Add"
        onClick={() => navigate(`/day/${today}/add`)}
        style={{ cursor: 'pointer' }}
      >
        <Icon name="plus" size={24} stroke={2.4} color="#fff" />
      </button>

      <TabBar />
    </Screen>
  )
}

function MealRow({ m, onClick }: { m: Meal; onClick: () => void }) {
  const ic: IconName = ({ Breakfast: 'sun', Lunch: 'pizza', Dinner: 'moon', Snack: 'cookie', Drink: 'cup' } as const)[m.type]
  const timeStr = m.time?.toDate
    ? m.time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div
      className="card"
      style={{ padding: 14, cursor: 'pointer' }}
      onClick={onClick}
      role="button"
    >
      <div className="row spread aic" style={{ marginBottom: 8 }}>
        <div className="row gap-10 aic">
          <div
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-2)',
            }}
          >
            <Icon name={ic} size={16} />
          </div>
          <div className="col">
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.type}</div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 500 }}>
              {timeStr} · {m.items.length} items
            </div>
          </div>
        </div>
        <div className="row gap-8 aib">
          <span style={{ fontWeight: 700, fontSize: 16 }}>{m.kcal}</span>
          <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>kcal</span>
        </div>
      </div>
      <div className="row gap-6">
        <span className="pill chip-carbs" style={{ height: 22, fontSize: 11.5 }}>{m.c_g}g C</span>
        <span className="pill chip-protein" style={{ height: 22, fontSize: 11.5 }}>{m.p_g}g P</span>
        <span className="pill chip-fat" style={{ height: 22, fontSize: 11.5 }}>{m.f_g}g F</span>
      </div>
    </div>
  )
}
