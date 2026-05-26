import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/ui/Icon'
import { Logo } from '../components/ui/Logo'
import { MacroBar } from '../components/ui/MacroBar'
import { StackBar } from '../components/ui/StackBar'
import { DayStrip } from '../components/ui/DayStrip'
import { TabBar } from '../components/ui/TabBar'
import { Screen } from '../components/ui/Screen'
import { DayLabelsPicker } from '../components/forms/DayLabelsPicker'
import { useDay } from '../hooks/useDay'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { useLast7Days } from '../hooks/useLast7Days'
import { addDays, parseKey, todayKey, formatShortDate } from '../lib/dateKey'
import { gramsFromGoal } from '../lib/macros'
import type { Meal, MealItem, MealType } from '../types/firestore'

// Fixed order for the Home meal-type groups. Predictable top-to-bottom even
// when meals are logged out of sequence (e.g. Snack at 10am before Lunch).
const TYPE_ORDER: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink']

const TYPE_ICON: Record<MealType, IconName> = {
  Breakfast: 'sun',
  Lunch: 'pizza',
  Dinner: 'moon',
  Snack: 'cookie',
  Drink: 'cup',
}

type MealGroup = {
  type: MealType
  items: MealItem[]
  kcal: number
  c_g: number
  p_g: number
  f_g: number
}

// Group meals of the same type into a single visual section. Items keep their
// chronological order across meal entries: sorted by parent meal time, then by
// the item's position within that meal.
function groupMealsByType(meals: Meal[]): MealGroup[] {
  const buckets = new Map<MealType, MealGroup & { _ordered: { it: MealItem; t: number; i: number }[] }>()
  for (const m of meals) {
    let g = buckets.get(m.type)
    if (!g) {
      g = { type: m.type, items: [], kcal: 0, c_g: 0, p_g: 0, f_g: 0, _ordered: [] }
      buckets.set(m.type, g)
    }
    g.kcal += m.kcal
    g.c_g += m.c_g
    g.p_g += m.p_g
    g.f_g += m.f_g
    const t = m.time?.toMillis ? m.time.toMillis() : 0
    m.items.forEach((it, i) => g._ordered.push({ it, t, i }))
  }
  return TYPE_ORDER.filter((t) => buckets.has(t)).map((t) => {
    const g = buckets.get(t)!
    g._ordered.sort((a, b) => a.t - b.t || a.i - b.i)
    g.items = g._ordered.map((e) => e.it)
    return g
  })
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Home() {
  const navigate = useNavigate()
  const today = todayKey()
  const { day, meals, loading } = useDay(today)
  const { goal } = useActiveGoal(today)
  const { days: weekBundles } = useLast7Days(today)

  // Goal: derive grams from live Goal (kcal + percentages). Fallback while loading.
  const goalKcal = goal?.kcal ?? 2200
  const goalGrams = goal
    ? gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
    : { c_g: 250, p_g: 160, f_g: 70 }

  // Consumed: live day totals; zeros if day doc absent.
  const consumed = day?.totals ?? { kcal: 0, c_g: 0, p_g: 0, f_g: 0 }

  const remaining = Math.max(0, goalKcal - consumed.kcal)
  const pct = goalKcal > 0 ? Math.round((consumed.kcal / goalKcal) * 100) : 0

  const dateStr = formatShortDate(today)

  // Day strip: real 7-day window. Today's slot uses the live useDay totals
  // (so newly logged meals appear instantly); the other 6 come from the
  // useLast7Days one-shot snapshot, which is accurate enough for past days.
  const weekDays = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
    return dates.map((date) => {
      const isToday = date === today
      const totals = isToday
        ? day?.totals
        : weekBundles.find((b) => b.date === date)?.day?.totals
      const d = parseKey(date)
      return {
        dow: DOW[d.getDay()],
        num: d.getDate(),
        date,
        kcal: totals?.kcal ?? 0,
        c: totals?.c_g ?? 0,
        p: totals?.p_g ?? 0,
        f: totals?.f_g ?? 0,
      }
    })
  }, [today, day, weekBundles])

  // Macro split percentages (Atwater approximation; harmless drift for mainstream foods)
  const carbsPct = consumed.kcal > 0 ? Math.round(((consumed.c_g * 4) / consumed.kcal) * 100) : 0
  const proteinPct = consumed.kcal > 0 ? Math.round(((consumed.p_g * 4) / consumed.kcal) * 100) : 0
  const fatPct = consumed.kcal > 0 ? Math.round(((consumed.f_g * 9) / consumed.kcal) * 100) : 0

  const groups = useMemo(() => groupMealsByType(meals), [meals])

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
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <DayStrip
            days={weekDays}
            todayIdx={6}
            goal={goalKcal}
            onPick={(d) => navigate(d.date === today ? '/' : `/day/${d.date}`)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <DayLabelsPicker dateKey={today} appliedIds={day?.labelIds ?? []} compact />
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
          <div className="section-title">Meals</div>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </span>
        </div>
        <div className="col gap-10">
          {groups.map((g) => (
            <MealGroupCard key={g.type} group={g} onClick={() => navigate(`/day/${today}`)} />
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
        aria-label="Scan to log a meal"
        onClick={() => navigate('/scanner')}
        style={{ cursor: 'pointer' }}
      >
        <Icon name="plus" size={24} stroke={2.4} color="#fff" />
      </button>

      <TabBar />
    </Screen>
  )
}

function MealGroupCard({ group, onClick }: { group: MealGroup; onClick: () => void }) {
  const ic = TYPE_ICON[group.type]
  const itemCount = group.items.length
  return (
    <div
      className="card"
      style={{ padding: 14, cursor: 'pointer' }}
      onClick={onClick}
      role="button"
    >
      <div className="row spread aic" style={{ marginBottom: 10 }}>
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
            <div style={{ fontWeight: 700, fontSize: 14 }}>{group.type}</div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 500 }}>
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="row gap-8 aib">
          <span style={{ fontWeight: 700, fontSize: 16 }}>{group.kcal}</span>
          <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>kcal</span>
        </div>
      </div>
      <div className="col gap-6" style={{ marginBottom: 10, paddingLeft: 42 }}>
        {group.items.map((it, i) => (
          <div key={i} className="row spread aic" style={{ fontSize: 12.5, gap: 10 }}>
            <div
              style={{
                color: 'var(--ink-2)',
                fontWeight: 500,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {it.name}
            </div>
            <div
              className="tnum"
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0 }}
            >
              {it.kcal}{' '}
              <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>kcal</span>
            </div>
          </div>
        ))}
      </div>
      <div className="row gap-6">
        <span className="pill chip-carbs" style={{ height: 22, fontSize: 11.5 }}>{group.c_g}g C</span>
        <span className="pill chip-protein" style={{ height: 22, fontSize: 11.5 }}>{group.p_g}g P</span>
        <span className="pill chip-fat" style={{ height: 22, fontSize: 11.5 }}>{group.f_g}g F</span>
      </div>
    </div>
  )
}
