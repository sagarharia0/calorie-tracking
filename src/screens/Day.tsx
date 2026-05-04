import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, type IconName } from '../components/ui/Icon'
import { MacroBar } from '../components/ui/MacroBar'
import { StackBar } from '../components/ui/StackBar'
import { Screen } from '../components/ui/Screen'
import { FlagChip } from '../components/ui/SwapBits'
import { flagItem } from '../lib/flags'
import { useAuth } from '../contexts/AuthContext'
import { useDay } from '../hooks/useDay'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { todayKey, parseKey, addDays } from '../lib/dateKey'
import { gramsFromGoal } from '../lib/macros'
import { deleteMeal } from '../lib/repo/meals'
import type { Meal } from '../types/firestore'

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(key: string) {
  const d = parseKey(key)
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

export default function Day() {
  const { date } = useParams()
  const dateKey = date ?? todayKey()
  const navigate = useNavigate()

  const { day, meals } = useDay(dateKey)
  const { goal } = useActiveGoal(dateKey)

  const goalKcal = goal?.kcal ?? 2200
  const goalGrams = goal
    ? gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
    : { c_g: 250, p_g: 160, f_g: 70 }
  const consumed = day?.totals ?? { kcal: 0, c_g: 0, p_g: 0, f_g: 0 }

  const dateObj = parseKey(dateKey)
  const titleLong = `${WEEKDAY_LONG[dateObj.getDay()]}, ${MONTH_SHORT[dateObj.getMonth()]} ${dateObj.getDate()}`
  const isToday = dateKey === todayKey()
  const prevDate = addDays(dateKey, -1)
  const nextDate = addDays(dateKey, 1)

  const onTrack = consumed.kcal > 0 && consumed.kcal <= goalKcal
  const over = consumed.kcal > goalKcal

  return (
    <Screen label="02 Day Detail">
      <div className="appbar">
        <button
          className="pill"
          onClick={() => navigate(-1)}
          style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div className="col aic" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{titleLong}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
            {isToday ? 'Today' : shortDate(dateKey)}
          </div>
        </div>
        <button className="pill" style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}>
          <Icon name="more" size={18} />
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        <div className="row spread aic" style={{ marginBottom: 12, padding: '4px 6px' }}>
          <button
            onClick={() => navigate(`/day/${prevDate}`)}
            className="row gap-6 aic"
            style={{ border: 0, background: 'transparent', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="back" size={14} /> {shortDate(prevDate)}
          </button>
          <button
            onClick={() => navigate(`/day/${nextDate}`)}
            className="row gap-6 aic"
            style={{ border: 0, background: 'transparent', color: 'var(--ink-4)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {shortDate(nextDate)} <Icon name="forward" size={14} />
          </button>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row spread aic" style={{ marginBottom: 14, gap: 8 }}>
            <div className="col" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total</div>
              <div className="row aib gap-6" style={{ flexWrap: 'nowrap' }}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {consumed.kcal.toLocaleString()}
                </div>
                <div className="muted tnum" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>/ {goalKcal.toLocaleString()} kcal</div>
              </div>
            </div>
            {onTrack && (
              <div className="pill" style={{ background: 'var(--protein-2)', color: 'color-mix(in oklch, var(--protein), black 30%)', fontWeight: 700, flexShrink: 0, fontSize: 11.5 }}>
                <Icon name="check" size={12} /> On track
              </div>
            )}
            {over && (
              <div className="pill" style={{ background: 'var(--fat-2)', color: 'color-mix(in oklch, var(--fat), black 30%)', fontWeight: 700, flexShrink: 0, fontSize: 11.5 }}>
                Over goal
              </div>
            )}
          </div>
          <StackBar c={consumed.c_g * 4} p={consumed.p_g * 4} f={consumed.f_g * 9} total={goalKcal} height={12} />
          <div style={{ height: 14 }} />
          <div className="col gap-12">
            <MacroBar name="Carbs" current={consumed.c_g} goal={goalGrams.c_g} varName="carbs" />
            <MacroBar name="Protein" current={consumed.p_g} goal={goalGrams.p_g} varName="protein" />
            <MacroBar name="Fat" current={consumed.f_g} goal={goalGrams.f_g} varName="fat" />
          </div>
        </div>

        <div className="section-title" style={{ padding: '8px 4px' }}>Context</div>
        <div className="row gap-6" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: 'var(--surface-2)' }}>
            <Icon name="plus" size={12} /> Add label
          </span>
        </div>

        <div className="section-title" style={{ padding: '8px 4px' }}>Timeline</div>
        {meals.length === 0 ? (
          <div className="card" style={{ padding: 18, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
              No meals logged for this day.
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {meals.map((m, i) => (
              <Timeline key={m.id} m={m} dateKey={dateKey} last={i === meals.length - 1} />
            ))}
          </div>
        )}

        <div style={{ height: 12 }} />
        <button
          className="btn"
          onClick={() => navigate(`/day/${dateKey}/add`)}
          style={{ cursor: 'pointer' }}
        >
          <Icon name="plus" size={16} color="#fff" /> Log a meal
        </button>
      </div>
    </Screen>
  )
}

function Timeline({ m, dateKey, last }: { m: Meal; dateKey: string; last: boolean }) {
  const ic: IconName = ({ Breakfast: 'sun', Lunch: 'pizza', Dinner: 'moon', Snack: 'cookie', Drink: 'cup' } as const)[m.type]
  const timeStr = m.time?.toDate
    ? m.time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—'
  const navigate = useNavigate()
  const { user } = useAuth()
  const [deleting, setDeleting] = useState(false)

  const onDelete = async () => {
    if (!user || deleting) return
    if (!window.confirm(`Delete this ${m.type} (${m.kcal} kcal)?`)) return
    setDeleting(true)
    try {
      await deleteMeal(user.uid, dateKey, m.id)
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : 'unknown'}`)
      setDeleting(false)
    }
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: last ? 'none' : '1px solid var(--hairline)', opacity: deleting ? 0.5 : 1 }}>
      <div className="row spread aic" style={{ marginBottom: 8, gap: 8 }}>
        <div className="row gap-10 aic" style={{ minWidth: 0 }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: 9,
              background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-2)',
              flexShrink: 0,
            }}
          >
            <Icon name={ic} size={15} />
          </div>
          <div className="col" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.type}</div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 500 }}>{timeStr}</div>
          </div>
        </div>
        <div className="row gap-8 aic" style={{ flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {m.kcal} <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>kcal</span>
          </div>
          <button
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete meal"
            className="pill"
            style={{
              border: 0,
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
              height: 28,
              width: 28,
              padding: 0,
              cursor: deleting ? 'wait' : 'pointer',
            }}
          >
            <Icon name="trash" size={13} color="var(--ink-3)" />
          </button>
        </div>
      </div>
      <div className="col gap-8" style={{ paddingLeft: 40 }}>
        {m.items.map((it, i) => {
          const flags = flagItem(it)
          const flagged = flags.length > 0
          return (
            <div key={i} className="col gap-3">
              <div className="row spread aic" style={{ fontSize: 12.5, gap: 10 }}>
                <div style={{ color: 'var(--ink-2)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.name}
                </div>
                <div className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0 }}>
                  {it.kcal} <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>kcal</span>
                </div>
              </div>
              <div className="row spread aic" style={{ gap: 8 }}>
                <div className="row gap-6" style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
                  <span style={{ color: 'color-mix(in oklch, var(--carbs), black 30%)' }}>{it.c_g}c</span>
                  <span style={{ color: 'color-mix(in oklch, var(--protein), black 28%)' }}>{it.p_g}p</span>
                  <span style={{ color: 'color-mix(in oklch, var(--fat), black 30%)' }}>{it.f_g}f</span>
                  {flags.map((f) => <FlagChip key={f} flag={f} />)}
                </div>
                {flagged && (
                  <button
                    onClick={() => navigate(`/swaps/${dateKey}/${m.id}/${i}`)}
                    style={{
                      border: 0, padding: '0 8px', height: 22,
                      background: 'var(--accent-2)', color: 'var(--accent)',
                      fontSize: 10.5, fontWeight: 700, borderRadius: 999,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="sparkle" size={10} color="var(--accent)" /> Swap
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
