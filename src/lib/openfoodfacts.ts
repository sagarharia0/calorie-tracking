// Open Food Facts barcode lookup. Public API, no key needed.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
//
// We hit the v2 product endpoint by code. ~25% of OFF entries have complete
// nutrition; the rest will return null macros and we degrade gracefully —
// the user can fill in the gaps in AddMeal.

export type OffProduct = {
  barcode: string
  name: string
  brand: string | null
  // per-100g values, all optional since OFF data quality is uneven
  per100g: {
    kcal: number | null
    c_g: number | null
    p_g: number | null
    f_g: number | null
  }
  servingSize: string | null
}

const OFF_USER_AGENT = 'Macro-CalorieTracker/0.1 (personal use)'

// Coerce OFF's numeric fields — they sometimes come back as strings.
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export async function lookupBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=code,product_name,brands,nutriments,serving_size`
  let res: Response
  try {
    res = await fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT } })
  } catch {
    throw new Error('Network error contacting Open Food Facts.')
  }
  if (!res.ok) {
    throw new Error(`Open Food Facts returned ${res.status}.`)
  }
  const data = (await res.json()) as {
    status?: number
    product?: {
      code?: string
      product_name?: string
      brands?: string
      nutriments?: Record<string, unknown>
      serving_size?: string
    }
  }
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const n = p.nutriments ?? {}
  return {
    barcode: p.code ?? barcode,
    name: (p.product_name ?? '').trim() || `Barcode ${barcode}`,
    brand: p.brands ? p.brands.split(',')[0].trim() : null,
    per100g: {
      // OFF stores kcal under either energy-kcal_100g or energy_100g (kJ).
      kcal: num(n['energy-kcal_100g']) ?? convertKjToKcal(num(n['energy_100g'])),
      c_g: num(n['carbohydrates_100g']),
      p_g: num(n['proteins_100g']),
      f_g: num(n['fat_100g']),
    },
    servingSize: p.serving_size ?? null,
  }
}

function convertKjToKcal(kj: number | null): number | null {
  return kj === null ? null : Math.round(kj / 4.184)
}
