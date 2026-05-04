import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/ui/Icon'
import { TabBar } from '../components/ui/TabBar'
import { Screen } from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { useLast7Days } from '../hooks/useLast7Days'
import { subscribeToLabels } from '../lib/repo/labels'
import { todayKey } from '../lib/dateKey'
import { gramsFromGoal } from '../lib/macros'
import { flagItem } from '../lib/flags'
import {
  activeGoalFor,
  byLabelAverages,
  daysHitMacros,
  daysWithAlcohol,
  daysWithinKcal,
  streak,
  totalAlcoholUnits,
} from '../lib/insightsCalc'
import { insightSummary, type InsightSummaryOutput } from '../lib/cloud'
import type { Label } from '../types/firestore'

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type SummaryState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; data: InsightSummaryOutput }
  | { phase: 'error'; message: string }

export default function Insights() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayKey()
  const { days, loading: daysLoading } = useLast7Days(today)
  const { goals } = useActiveGoal(today)
  const todayGoal = activeGoalFor(today, goals)

  const [labels, setLabels] = useState<Label[] | null>(null)
  useEffect(() => {
    if (!user) return
    return subscribeToLabels(user.uid, setLabels)
  }, [user])

  const [summary, setSummary] = useState<SummaryState>({ phase: 'idle' })

  // Fire LLM call once data + goal are loaded. Caches per-user in localStorage,
  // keyed by a content hash of the request — same numbers + same goal = no call.
  useEffect(() => {
    if (daysLoading || !todayGoal || !user) return
    let cancelled = false
    const goalGrams = gramsFromGoal(
      todayGoal.kcal, todayGoal.carbsPct, todayGoal.proteinPct, todayGoal.fatPct,
    )
    const apiDays = days.map((b) => {
      const allItems = b.meals.flatMap((m) =>
        m.items.map((it) => ({ ...it, mealType: m.type })),
      )
      const flaggedItems = allItems
        .filter((it) => flagItem(it).length > 0)
        .sort((a, b2) => b2.kcal - a.kcal)
        .slice(0, 3)
        .map((it) => ({
          name: it.name,
          kcal: it.kcal,
          c_g: it.c_g,
          p_g: it.p_g,
          f_g: it.f_g,
          mealType: it.mealType,
        }))
      const labelNames = (b.day?.labelIds ?? [])
        .map((id) => labels?.find((l) => l.id === id)?.name)
        .filter((n): n is string => !!n)
        .sort()
      return {
        date: b.date,
        kcal: b.day?.totals.kcal ?? 0,
        c_g: b.day?.totals.c_g ?? 0,
        p_g: b.day?.totals.p_g ?? 0,
        f_g: b.day?.totals.f_g ?? 0,
        alcohol_g: b.day?.totals.alcohol_g ?? 0,
        units: b.day?.totals.units ?? 0,
        mealCount: b.day?.totals.mealCount ?? 0,
        labels: labelNames,
        flaggedItems,
      }
    })

    const apiInput = {
      days: apiDays,
      goal: {
        kcal: todayGoal.kcal,
        c_g: goalGrams.c_g,
        p_g: goalGrams.p_g,
        f_g: goalGrams.f_g,
        weeklyUnitsTarget: todayGoal.weeklyUnitsTarget,
      },
    }

    // Content-hash cache. Same input → same output, no LLM call.
    // Bumping the version key (v1 → v2) invalidates all cached entries
    // — useful when prompt or schema changes meaningfully.
    const cacheKey = `insightSummary:v1:${user.uid}`
    const inputHash = JSON.stringify(apiInput) + '|' + todayGoal.id
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const cached = JSON.parse(raw) as { hash: string; data: InsightSummaryOutput }
        if (cached.hash === inputHash) {
          setSummary({ phase: 'ok', data: cached.data })
          return
        }
      }
    } catch {
      // Corrupt cache entry — fall through and refetch.
    }

    setSummary({ phase: 'loading' })
    insightSummary(apiInput)
      .then((data) => {
        if (cancelled) return
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ hash: inputHash, data }))
        } catch {
          // localStorage full or disabled — ignore; we still render the data.
        }
        setSummary({ phase: 'ok', data })
      })
      .catch((err) => {
        if (cancelled) return
        setSummary({
          phase: 'error',
          message: err instanceof Error ? err.message : 'AI provider error.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [daysLoading, todayGoal?.id, days, labels, user])

  const within = useMemo(() => daysWithinKcal(days, goals), [days, goals])
  const hit = useMemo(() => daysHitMacros(days, goals), [days, goals])
  const strk = useMemo(() => streak(days), [days])
  const labelStats = useMemo(() => byLabelAverages(days, labels ?? []), [days, labels])
  const totalUnits = useMemo(() => totalAlcoholUnits(days), [days])
  const alcoholDays = useMemo(() => daysWithAlcohol(days), [days])
  const showAlcoholCard = totalUnits > 0

  const goalKcal = todayGoal?.kcal ?? 2200
  const max = Math.max(...days.map((b) => b.day?.totals.kcal ?? 0), goalKcal) * 1.05 || goalKcal

  return (
    <Screen label="05 Insights">
      <div className="appbar">
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Insights</div>
        <div className="pill" style={{ height: 30, fontSize: 12, fontWeight: 600 }}>
          Last 7 days
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        {/* Scoreboard */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>This week</div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            <Counter value={within} total={7}>Days within<br />kcal limit</Counter>
            <div style={{ width: 1, background: 'var(--hairline)', alignSelf: 'stretch' }} />
            <Counter value={hit} total={7} indented>Days hit<br />macro target</Counter>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.5 }}>
            Macro target = within 10% of carbs / protein / fat goals on a single day.
          </div>
        </div>

        {/* Bar chart */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row spread aic" style={{ marginBottom: 14, gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>Calories per day</div>
            <div className="row gap-8" style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>
              <span className="row gap-4 aic"><span className="swatch" style={{ background: 'var(--carbs)' }} />C</span>
              <span className="row gap-4 aic"><span className="swatch" style={{ background: 'var(--protein)' }} />P</span>
              <span className="row gap-4 aic"><span className="swatch" style={{ background: 'var(--fat)' }} />F</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 140, marginBottom: 10 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${(1 - goalKcal / max) * 100}%`, borderTop: '1.5px dashed var(--ink-4)', zIndex: 2 }}>
              <span style={{ position: 'absolute', left: 0, top: -7, fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--card-bg)', padding: '0 4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Goal
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: '100%' }}>
              {days.map((b, i) => {
                const t = b.day?.totals
                const cKcal = (t?.c_g ?? 0) * 4
                const pKcal = (t?.p_g ?? 0) * 4
                const fKcal = (t?.f_g ?? 0) * 9
                const total = cKcal + pKcal + fKcal
                const h = total > 0 ? (total / max) * 100 : 0
                return (
                  <div key={i} className="col" style={{ flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      className="col-bar"
                      style={{
                        height: `${h}%`,
                        width: '100%',
                        background: 'transparent',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        borderRadius: '6px 6px 0 0',
                        overflow: 'hidden',
                      }}
                    >
                      {total > 0 && (
                        <>
                          <span style={{ display: 'block', width: '100%', height: `${(cKcal / total) * 100}%`, background: 'var(--carbs)' }} />
                          <span style={{ display: 'block', width: '100%', height: `${(pKcal / total) * 100}%`, background: 'var(--protein)' }} />
                          <span style={{ display: 'block', width: '100%', height: `${(fKcal / total) * 100}%`, background: 'var(--fat)' }} />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="row" style={{ display: 'flex', gap: 8 }}>
            {days.map((b, i) => {
              const dow = DOW_SHORT[new Date(b.date).getDay()]
              const kcal = b.day?.totals.kcal ?? 0
              const isToday = b.date === today
              return (
                <div key={i} className="col" style={{ flex: 1, alignItems: 'center', gap: 1 }}>
                  <div className="tnum" style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--ink)' : 'var(--ink-3)' }}>{dow}</div>
                  <div className="tnum" style={{ fontSize: 9.5, color: 'var(--ink-4)', fontWeight: 600 }}>
                    {kcal > 0 ? `${Math.round(kcal / 100) / 10}k` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* By label */}
        {labelStats.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>By label</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>How context shifts your intake</div>
            {labelStats.map((s, i) => {
              const has = s.dayCount > 0
              const vs = has ? s.avgKcal - goalKcal : 0
              const over = vs > 0
              const w = has ? (s.avgKcal / (max || goalKcal)) * 100 : 0
              const goalPct = (goalKcal / (max || goalKcal)) * 100
              return (
                <div key={s.label.id} className="col gap-4" style={{ marginBottom: i === labelStats.length - 1 ? 0 : 14 }}>
                  <div className="row spread aic">
                    <div className="row gap-8 aic">
                      <Icon name={s.label.icon as IconName} size={14} color="var(--ink-2)" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                        {s.label.name}
                      </span>
                      <span className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>
                        {s.dayCount} day{s.dayCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="row gap-8 aib">
                      {has ? (
                        <>
                          <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{s.avgKcal.toLocaleString()}</span>
                          <span
                            className="tnum"
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: over
                                ? 'color-mix(in oklch, var(--fat), black 30%)'
                                : 'color-mix(in oklch, var(--protein), black 28%)',
                            }}
                          >
                            {over ? '+' : ''}{vs}
                          </span>
                        </>
                      ) : (
                        <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>—</span>
                      )}
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div className="bar" style={{ color: over ? 'var(--fat)' : 'var(--protein)' }}>
                      <i style={{ width: `${w}%` }} />
                    </div>
                    <div style={{ position: 'absolute', left: `${goalPct}%`, top: -2, bottom: -2, width: 1.5, background: 'var(--ink)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Streak */}
        {strk > 0 && (
          <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'var(--fat-2)',
                color: 'color-mix(in oklch, var(--fat), black 30%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="streak" size={22} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <div className="row aib gap-6">
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{strk}</div>
                <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>day streak</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                {strk === 7
                  ? 'Logged every day this week.'
                  : `${strk} consecutive day${strk === 1 ? '' : 's'} logged.`}
              </div>
            </div>
          </div>
        )}

        {/* Alcohol card (conditional) */}
        {showAlcoholCard && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row gap-8 aic" style={{ marginBottom: 8 }}>
              <Icon name="cup" size={14} color="var(--ink-2)" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
                Alcohol
              </span>
            </div>
            <div className="row spread aib" style={{ marginBottom: 6, gap: 8 }}>
              <div className="col">
                <div className="row aib gap-6">
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {totalUnits.toFixed(1)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>units</div>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  across {alcoholDays} day{alcoholDays === 1 ? '' : 's'}
                </div>
              </div>
              {todayGoal?.weeklyUnitsTarget && (
                <div className="col" style={{ alignItems: 'flex-end' }}>
                  <div className="muted tnum" style={{ fontSize: 11, fontWeight: 700 }}>
                    {todayGoal.weeklyUnitsTarget} target
                  </div>
                  <div
                    className="tnum"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        totalUnits > todayGoal.weeklyUnitsTarget
                          ? 'color-mix(in oklch, var(--fat), black 30%)'
                          : 'color-mix(in oklch, var(--protein), black 28%)',
                    }}
                  >
                    {totalUnits > todayGoal.weeklyUnitsTarget ? '+' : ''}
                    {(totalUnits - todayGoal.weeklyUnitsTarget).toFixed(1)}
                  </div>
                </div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              NHS guidance: ≤14 units/week. 1 unit = 8g pure ethanol.
            </div>
          </div>
        )}

        {/* What's working — LLM */}
        <div
          className="card"
          style={{
            background: 'var(--ink)',
            color: '#fff',
            border: 0,
            marginBottom: 14,
          }}
        >
          <div className="row gap-8 aic" style={{ marginBottom: 8, opacity: 0.8 }}>
            <Icon name="sparkle" size={14} color="#fff" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              What's working
            </span>
          </div>
          {summary.phase === 'loading' || summary.phase === 'idle' ? (
            <div style={{ fontSize: 14, opacity: 0.6, lineHeight: 1.4 }}>Asking the LLM…</div>
          ) : summary.phase === 'error' ? (
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
              Couldn't generate this week's narrative. {summary.message}
            </div>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
              {summary.data.whatsWorking}
            </div>
          )}
        </div>

        {/* Biggest swap opportunity — LLM */}
        {summary.phase === 'ok' && summary.data.swapOpportunity && (
          <div
            className="card"
            style={{
              borderLeft: '3px solid var(--accent)',
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
            }}
          >
            <div className="row gap-8 aic" style={{ marginBottom: 6 }}>
              <Icon name="sparkle" size={14} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                Biggest swap opportunity
              </span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.45, marginBottom: 4 }}>
              <b>{summary.data.swapOpportunity.itemName}</b> → <b>{summary.data.swapOpportunity.suggestedSwap}</b>{' '}
              <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>
                (~{summary.data.swapOpportunity.weeklyKcalCost} kcal/week)
              </span>
            </div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
              {summary.data.swapOpportunity.narrative}
            </div>
            <button
              onClick={() => navigate(`/day/${today}`)}
              style={{
                border: 0,
                height: 32,
                padding: '0 14px',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              View today →
            </button>
          </div>
        )}
      </div>

      <TabBar />
    </Screen>
  )
}

function Counter({
  value,
  total,
  children,
  indented = false,
}: {
  value: number
  total: number
  children: React.ReactNode
  indented?: boolean
}) {
  return (
    <div className="col" style={{ flex: 1, paddingLeft: indented ? 18 : 0 }}>
      <div className="row aib gap-6">
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
          {value}
        </div>
        <div className="muted tnum" style={{ fontSize: 13, fontWeight: 600 }}>/ {total}</div>
      </div>
      <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>
        {children}
      </div>
    </div>
  )
}
