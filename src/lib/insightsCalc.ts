import { gramsFromGoal } from './macros'
import type { DayBundle } from '../hooks/useLast7Days'
import type { Goal, Label } from '../types/firestore'

// Pure helpers operating on the past-7-days bundle + goal history.
// Each function takes the data it needs; no Firestore awareness.

const MACRO_BAND = 0.1 // ±10% per memory/insights_design.md

// Goal active for a given date = latest goal where effectiveFrom ≤ date.
export function activeGoalFor(date: string, goals: Goal[]): Goal | null {
  return goals.find((g) => g.effectiveFrom <= date) ?? null
}

export function daysWithinKcal(days: DayBundle[], goals: Goal[]): number {
  return days.filter((b) => {
    if (!b.day || b.day.totals.kcal <= 0) return false
    const g = activeGoalFor(b.date, goals)
    if (!g) return false
    return b.day.totals.kcal <= g.kcal
  }).length
}

export function daysHitMacros(days: DayBundle[], goals: Goal[]): number {
  return days.filter((b) => {
    if (!b.day || b.day.totals.kcal <= 0) return false
    const g = activeGoalFor(b.date, goals)
    if (!g) return false
    const target = gramsFromGoal(g.kcal, g.carbsPct, g.proteinPct, g.fatPct)
    const within = (got: number, want: number) =>
      want <= 0 ? true : Math.abs(got - want) / want <= MACRO_BAND
    return (
      within(b.day.totals.c_g, target.c_g) &&
      within(b.day.totals.p_g, target.p_g) &&
      within(b.day.totals.f_g, target.f_g)
    )
  }).length
}

// Sequential days going back from the most recent that have a logged meal.
// Stops at first gap. Returns count.
export function streak(days: DayBundle[]): number {
  let n = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const has = (days[i].day?.totals.mealCount ?? 0) > 0
    if (!has) break
    n++
  }
  return n
}

export type LabelStat = {
  label: Label
  avgKcal: number
  dayCount: number
}

// Average kcal per day broken down by label. A day can have multiple labels
// applied — its kcal contributes to each. Days with 0 logged are excluded.
export function byLabelAverages(days: DayBundle[], labels: Label[]): LabelStat[] {
  const byId = new Map<string, { sum: number; n: number }>()
  for (const b of days) {
    if (!b.day) continue
    if (b.day.totals.kcal <= 0) continue
    for (const labelId of b.day.labelIds ?? []) {
      const cur = byId.get(labelId) ?? { sum: 0, n: 0 }
      cur.sum += b.day.totals.kcal
      cur.n += 1
      byId.set(labelId, cur)
    }
  }
  return labels
    .filter((l) => !l.archived)
    .map((l) => {
      const s = byId.get(l.id)
      return {
        label: l,
        avgKcal: s ? Math.round(s.sum / s.n) : 0,
        dayCount: s?.n ?? 0,
      }
    })
}

export function totalAlcoholUnits(days: DayBundle[]): number {
  return days.reduce((acc, b) => acc + (b.day?.totals.units ?? 0), 0)
}

export function daysWithAlcohol(days: DayBundle[]): number {
  return days.filter((b) => (b.day?.totals.units ?? 0) > 0).length
}
