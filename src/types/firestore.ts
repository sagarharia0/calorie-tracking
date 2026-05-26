import type { Timestamp } from 'firebase/firestore'

// ─── Shared ─────────────────────────────────────────────────────

export type Macros = { c_g: number; p_g: number; f_g: number }

export type DateKey = string // 'YYYY-MM-DD'

// ─── User ───────────────────────────────────────────────────────

// Dietary preference. Filters LLM-generated suggestions (swap, suggestFoods,
// insightSummary). undefined = no restriction. Filters "flesh-only" — i.e.
// vegetarian excludes meat/poultry/fish as primary ingredients but tolerates
// trace gelatin/rennet/anchovies in condiments. See functions prompt code.
export type Diet = 'vegetarian' | 'vegan' | 'pescatarian'

export type User = {
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: Timestamp
  diet?: Diet
}

// ─── Goal (period-based, time-series) ───────────────────────────

export type Goal = {
  id: string
  effectiveFrom: DateKey
  kcal: number
  carbsPct: number
  proteinPct: number
  fatPct: number
  weeklyUnitsTarget?: number // optional alcohol target; NHS default 14
}

// ─── Label ──────────────────────────────────────────────────────

export type LabelColor = 'blue' | 'green' | 'amber' | 'rose' | 'slate'

export type Label = {
  id: string
  name: string
  icon: string // matches IconName from design but stored loose
  color: LabelColor
  archived?: boolean
}

// ─── Day ────────────────────────────────────────────────────────

export type DayTotals = {
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  alcohol_g: number
  units: number
  mealCount: number
}

export type Day = {
  id: DateKey
  date: DateKey
  labelIds: string[]
  totals: DayTotals
}

export const ZERO_TOTALS: DayTotals = {
  kcal: 0, c_g: 0, p_g: 0, f_g: 0, alcohol_g: 0, units: 0, mealCount: 0,
}

// ─── Meal ───────────────────────────────────────────────────────

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Drink'

export type AmountUnit = 'g' | 'ml' | 'serving'

export type MealItem = {
  name: string
  foodId?: string
  barcode?: string
  amount: number
  unit: AmountUnit
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  alcohol_g?: number
  units?: number // UK alcohol units, for alcoholic items only
}

export type Meal = {
  id: string
  type: MealType
  time: Timestamp
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  alcohol_g?: number
  items: MealItem[]
}

// ─── Food ───────────────────────────────────────────────────────

export type FoodKind = 'ingredient' | 'meal'

export type FoodSource = 'barcode' | 'manual' | 'cofid' | 'llm-suggested'

export type FoodPer100g = {
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  alcohol_g?: number
}

export type GoodFoodMeta = {
  markedBy: 'ai' | 'user'
  pinned: boolean
  whyTags: string[]
  addedAt: Timestamp
}

export type Food = {
  id: string
  name: string
  brand?: string
  barcode?: string
  per100g: FoodPer100g
  abv?: number // % alcohol by volume; for liquids only
  defaultServing?: { qty: number; unit: AmountUnit }
  kind: FoodKind
  source: FoodSource
  useCount: number
  lastUsedAt: Timestamp
  goodFood?: GoodFoodMeta
}
