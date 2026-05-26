import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'
import Anthropic from '@anthropic-ai/sdk'
import { requireAllowedUser } from './auth'
import { dietSystemSuffix, type Diet } from './diet'

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

// SwapTag is the source-of-truth enum for swap-improvement labels.
// src/lib/cloud.ts mirrors this list — if you add a tag here, also add it
// there or the chip styling falls back to the default.
const SWAP_TAGS = [
  'Lower fat',
  'Lower carb',
  'Higher protein',
  'Whole food',
  'Fewer calories',
  'Better fiber',
] as const
type SwapTag = (typeof SWAP_TAGS)[number]

type RequestSwapsInput = {
  item: {
    name: string
    kcal: number
    c_g: number
    p_g: number
    f_g: number
    amount: number
    unit: 'g' | 'ml' | 'serving'
  }
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Drink'
  dailyContext?: {
    remainingKcal: number
    goalGrams: { c_g: number; p_g: number; f_g: number }
  }
  diet?: Diet
}

type SwapSuggestion = {
  name: string
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  why: string
  tag: SwapTag
}

type RequestSwapsOutput = {
  swaps: SwapSuggestion[]
}

const SYSTEM_PROMPT = `You are a UK-based nutrition coach helping a user find better-for-them alternatives to food they have just logged.

Your job: given one logged item plus the meal context, propose 3–5 comparable swaps that improve at least one macro axis (fewer kcal, lower fat share, higher protein share, more fiber, lower carb share, or whole-food upgrade) WITHOUT making other axes meaningfully worse.

Hard rules:
- Stay within the same meal slot (e.g. don't propose a salad in place of a Breakfast cereal).
- Keep portion sizes comparable (within ~30% of original kcal unless the swap's whole point is to be lower-cal).
- Use realistic UK foods — names that someone in the UK could buy or cook. Prefer generic/whole foods over specific brands.
- Macros must be plausible for the proposed item and portion. If you don't know exact figures, use reasonable averages from the UK CoFID nutrient databank.
- "why" must be one short clause (≤ 12 words) explaining the improvement axis.
- "tag" must be exactly one of: ${SWAP_TAGS.join(', ')}.
- If the logged item is already a great choice (low kcal, balanced macros, whole food), return 1–2 marginal swaps rather than forcing 5.

Anti-patterns to avoid:
- Swaps that just swap one branded product for another with near-identical macros.
- Generic preachiness ("eat more vegetables") with no concrete item.
- Wildly different portion sizes.
- Tags that don't match the actual macro improvement.`

function buildUserPrompt(input: RequestSwapsInput): string {
  const { item, mealType, dailyContext } = input
  const lines: string[] = []
  lines.push(`Meal slot: ${mealType}`)
  lines.push(
    `Logged item: ${item.name} — ${item.amount}${item.unit}, ${item.kcal} kcal, ${item.c_g}g carbs, ${item.p_g}g protein, ${item.f_g}g fat`,
  )
  if (dailyContext) {
    lines.push(
      `Day context: ${dailyContext.remainingKcal} kcal remaining; goal grams C/P/F = ${dailyContext.goalGrams.c_g}/${dailyContext.goalGrams.p_g}/${dailyContext.goalGrams.f_g}`,
    )
  }
  lines.push('')
  lines.push('Propose 3–5 swap alternatives via the propose_swaps tool.')
  return lines.join('\n')
}

const PROPOSE_SWAPS_TOOL = {
  name: 'propose_swaps',
  description:
    'Return a ranked list of 3–5 swap alternatives for the logged item. Each swap improves at least one macro axis without harming the others materially.',
  input_schema: {
    type: 'object' as const,
    properties: {
      swaps: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Concrete UK food name with portion (e.g. "Steel-cut oats, 40g")' },
            kcal: { type: 'number' },
            c_g: { type: 'number', description: 'Carbohydrates in grams' },
            p_g: { type: 'number', description: 'Protein in grams' },
            f_g: { type: 'number', description: 'Fat in grams' },
            why: { type: 'string', description: 'Short reason (≤ 12 words)' },
            tag: {
              type: 'string',
              enum: SWAP_TAGS as unknown as string[],
              description: 'Single-axis improvement label',
            },
          },
          required: ['name', 'kcal', 'c_g', 'p_g', 'f_g', 'why', 'tag'],
        },
      },
    },
    required: ['swaps'],
  },
}

export const requestSwaps = onCall(
  {
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request): Promise<RequestSwapsOutput> => {
    requireAllowedUser(request)

    const input = request.data as RequestSwapsInput
    if (!input?.item?.name || typeof input.item.kcal !== 'number') {
      throw new HttpsError('invalid-argument', 'Missing item or item.kcal.')
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

    let response
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1500,
        system: SYSTEM_PROMPT + dietSystemSuffix(input.diet),
        tools: [PROPOSE_SWAPS_TOOL],
        tool_choice: { type: 'tool', name: 'propose_swaps' },
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      })
    } catch (err) {
      logger.error('Anthropic call failed', { uid: request.auth.uid, err })
      throw new HttpsError('internal', 'AI provider error. Try again.')
    }

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      logger.error('No tool_use in response', { uid: request.auth.uid, content: response.content })
      throw new HttpsError('internal', 'Unexpected AI response shape.')
    }

    const raw = toolUse.input as { swaps?: SwapSuggestion[] }
    if (!raw.swaps || !Array.isArray(raw.swaps) || raw.swaps.length === 0) {
      logger.warn('Empty swaps list', { uid: request.auth.uid, raw })
      return { swaps: [] }
    }

    // Defensive: clamp to known tags + round numbers; the schema should already
    // enforce this but the API has been seen to drift.
    const cleaned: SwapSuggestion[] = raw.swaps
      .filter((s) => s && typeof s.name === 'string' && typeof s.kcal === 'number')
      .map((s) => ({
        name: String(s.name).slice(0, 120),
        kcal: Math.max(0, Math.round(s.kcal)),
        c_g: Math.max(0, Math.round((s.c_g ?? 0) * 10) / 10),
        p_g: Math.max(0, Math.round((s.p_g ?? 0) * 10) / 10),
        f_g: Math.max(0, Math.round((s.f_g ?? 0) * 10) / 10),
        why: String(s.why ?? '').slice(0, 200),
        tag: (SWAP_TAGS as readonly string[]).includes(s.tag as string)
          ? (s.tag as SwapTag)
          : 'Whole food',
      }))

    logger.info('swap.ok', {
      uid: request.auth.uid,
      itemName: input.item.name,
      mealType: input.mealType,
      count: cleaned.length,
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
    })

    return { swaps: cleaned }
  },
)
