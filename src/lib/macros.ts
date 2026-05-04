import type { DayTotals, Meal } from '../types/firestore'

// Atwater calorie densities (kcal per gram)
export const KCAL_PER_G_CARBS = 4
export const KCAL_PER_G_PROTEIN = 4
export const KCAL_PER_G_FAT = 9
export const KCAL_PER_G_ALCOHOL = 7

// 1 UK alcohol unit = 8g of pure ethanol (= 10ml).
export const G_PER_UNIT = 8

// Convert kcal target + macro percentages → target grams.
// Used only for goal display / target derivation, never for storing item data.
export function gramsFromGoal(
  kcal: number,
  carbsPct: number,
  proteinPct: number,
  fatPct: number,
) {
  return {
    c_g: Math.round((kcal * carbsPct) / 100 / KCAL_PER_G_CARBS),
    p_g: Math.round((kcal * proteinPct) / 100 / KCAL_PER_G_PROTEIN),
    f_g: Math.round((kcal * fatPct) / 100 / KCAL_PER_G_FAT),
  }
}

// UK alcohol units from volume + ABV.
// units = (volume_ml × abv%) / 1000
export function alcoholUnits(volumeMl: number, abvPct: number): number {
  return (volumeMl * abvPct) / 1000
}

// Sum a list of meals into the day's cached totals.
// Source of truth is the meals collection — totals are recomputed on every meal write.
export function recomputeDayTotals(meals: Meal[]): DayTotals {
  let kcal = 0, c_g = 0, p_g = 0, f_g = 0, alcohol_g = 0
  for (const m of meals) {
    kcal += m.kcal
    c_g += m.c_g
    p_g += m.p_g
    f_g += m.f_g
    alcohol_g += m.alcohol_g ?? 0
  }
  return {
    kcal,
    c_g,
    p_g,
    f_g,
    alcohol_g,
    units: alcohol_g / G_PER_UNIT,
    mealCount: meals.length,
  }
}
