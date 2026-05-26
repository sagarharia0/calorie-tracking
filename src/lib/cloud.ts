import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { Diet, FoodKind, MealItem, MealType } from '../types/firestore'

// Mirrored from functions/src/swap.ts. The function is the source of truth
// for the SwapTag enum and SwapSuggestion shape — this file is the typed
// view the React app holds. Add a tag here when you add it on the function side.
export type SwapTag =
  | 'Lower fat'
  | 'Lower carb'
  | 'Higher protein'
  | 'Whole food'
  | 'Fewer calories'
  | 'Better fiber'

export type SwapSuggestion = {
  name: string
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  why: string
  tag: SwapTag
}

export type RequestSwapsInput = {
  item: Pick<MealItem, 'name' | 'kcal' | 'c_g' | 'p_g' | 'f_g' | 'amount' | 'unit'>
  mealType: MealType
  dailyContext?: {
    remainingKcal: number
    goalGrams: { c_g: number; p_g: number; f_g: number }
  }
  diet?: Diet
}

export type RequestSwapsOutput = {
  swaps: SwapSuggestion[]
}

const requestSwapsCallable = httpsCallable<RequestSwapsInput, RequestSwapsOutput>(
  functions,
  'requestSwaps',
)

export async function requestSwaps(input: RequestSwapsInput): Promise<RequestSwapsOutput> {
  const res = await requestSwapsCallable(input)
  return res.data
}

// ─── suggestFoods ──────────────────────────────────────────────
// Mirrored from functions/src/suggestFoods.ts.

export type WhyTag =
  | 'High protein'
  | 'Low cal'
  | 'Low fat'
  | 'High fiber'
  | 'Antioxidants'
  | 'Whole food'
  | 'Omega-3'
  | 'Balanced'
  | 'Veg-forward'

export type FoodSuggestion = {
  name: string
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  kind: FoodKind
  whyTags: WhyTag[]
}

export type SuggestFoodsInput = {
  existingGoods?: Array<{ name: string; kcal: number; kind: FoodKind }>
  recentMeals?: Array<{ name: string }>
  remainingKcal?: number
  goalGrams?: { c_g: number; p_g: number; f_g: number }
  preferKind?: FoodKind | 'any'
  diet?: Diet
}

export type SuggestFoodsOutput = {
  suggestions: FoodSuggestion[]
}

const suggestFoodsCallable = httpsCallable<SuggestFoodsInput, SuggestFoodsOutput>(
  functions,
  'suggestFoods',
)

export async function suggestFoods(input: SuggestFoodsInput): Promise<SuggestFoodsOutput> {
  const res = await suggestFoodsCallable(input)
  return res.data
}

// ─── insightSummary ────────────────────────────────────────────
// Mirrored from functions/src/insightSummary.ts.

export type InsightDaySummary = {
  date: string
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  alcohol_g: number
  units: number
  mealCount: number
  labels: string[]
  flaggedItems: Array<{
    name: string
    kcal: number
    c_g: number
    p_g: number
    f_g: number
    mealType: string
  }>
}

export type SwapOpportunity = {
  itemName: string
  weeklyKcalCost: number
  suggestedSwap: string
  narrative: string
}

export type InsightSummaryInput = {
  days: InsightDaySummary[]
  goal: { kcal: number; c_g: number; p_g: number; f_g: number; weeklyUnitsTarget?: number }
  diet?: Diet
}

export type InsightSummaryOutput = {
  whatsWorking: string
  swapOpportunity: SwapOpportunity | null
}

const insightSummaryCallable = httpsCallable<InsightSummaryInput, InsightSummaryOutput>(
  functions,
  'insightSummary',
)

export async function insightSummary(input: InsightSummaryInput): Promise<InsightSummaryOutput> {
  const res = await insightSummaryCallable(input)
  return res.data
}
