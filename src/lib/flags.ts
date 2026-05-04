// Item-level flagging + size/hunger bands.
// Source-of-truth thresholds live in memory/smart_swap_design.md — keep aligned.
//
// Flag rules (item-level, no goal context):
//   cal:  kcal > 220
//   fat:  (fat_g × 9) / kcal > 0.40
//   carb: (carbs_g × 4) / kcal > 0.65 AND kcal > 150
//   protein: never flagged (explicit pass).
//
// Size band: S < 100 kcal, M 100–250, L ≥ 250.
// Hunger band: Snack < 200, Light 200–400, Main ≥ 400.

export type Flag = 'cal' | 'fat' | 'carb'

export const FLAG_THRESHOLDS = {
  HIGH_KCAL: 220,
  FAT_SHARE: 0.4,
  CARB_SHARE: 0.65,
  CARB_MIN_KCAL: 150,
} as const

// Accepts both the live `MealItem` shape (c_g/p_g/f_g) and the legacy mock
// shape (c/p/f) — handy for the Swaps screen during transition.
export type FlaggableItem = {
  kcal: number
  c_g?: number; p_g?: number; f_g?: number
  c?: number; p?: number; f?: number
}

export function flagItem(it: FlaggableItem): Flag[] {
  const kcal = it.kcal || 1
  const c = it.c_g ?? it.c ?? 0
  const f = it.f_g ?? it.f ?? 0
  const flags: Flag[] = []
  if (kcal > FLAG_THRESHOLDS.HIGH_KCAL) flags.push('cal')
  if ((f * 9) / kcal > FLAG_THRESHOLDS.FAT_SHARE) flags.push('fat')
  if ((c * 4) / kcal > FLAG_THRESHOLDS.CARB_SHARE && kcal > FLAG_THRESHOLDS.CARB_MIN_KCAL) flags.push('carb')
  return flags
}

export const SIZE_BANDS = { S_MAX: 100, M_MAX: 250 } as const
export const sizeBand = (kcal: number): 'S' | 'M' | 'L' =>
  kcal < SIZE_BANDS.S_MAX ? 'S' : kcal < SIZE_BANDS.M_MAX ? 'M' : 'L'

export const HUNGER_BANDS = { SNACK_MAX: 200, LIGHT_MAX: 400 } as const
export const hungerBand = (kcal: number): 'Snack' | 'Light' | 'Main' =>
  kcal < HUNGER_BANDS.SNACK_MAX ? 'Snack' : kcal < HUNGER_BANDS.LIGHT_MAX ? 'Light' : 'Main'
