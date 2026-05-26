import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'
import Anthropic from '@anthropic-ai/sdk'
import { requireAllowedUser } from './auth'
import { dietSystemSuffix, type Diet } from './diet'

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

// whyTags enum from memory/smart_swap_design.md.
const WHY_TAGS = [
  'High protein',
  'Low cal',
  'Low fat',
  'High fiber',
  'Antioxidants',
  'Whole food',
  'Omega-3',
  'Balanced',
  'Veg-forward',
] as const
type WhyTag = (typeof WHY_TAGS)[number]

const FOOD_KINDS = ['ingredient', 'meal'] as const
type FoodKind = (typeof FOOD_KINDS)[number]

type SuggestFoodsInput = {
  existingGoods?: Array<{ name: string; kcal: number; kind: FoodKind }>
  recentMeals?: Array<{ name: string }>
  remainingKcal?: number
  goalGrams?: { c_g: number; p_g: number; f_g: number }
  preferKind?: FoodKind | 'any' // hint — UI tab can bias what gets suggested
  diet?: Diet
}

type FoodSuggestion = {
  name: string
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  kind: FoodKind
  whyTags: WhyTag[]
}

type SuggestFoodsOutput = {
  suggestions: FoodSuggestion[]
}

const SYSTEM_PROMPT = `You are a UK-based nutrition coach helping a user expand their personal "Good Foods" library — a curated list of foods they reach for repeatedly because they're macro-friendly and tasty.

Your job: propose exactly 5 new candidate foods that are NOT already in the user's library, and would plausibly fit their goals and eating patterns. The user accepts or rejects each.

Hard rules:
- Mix kinds sensibly: include both 'ingredient' (atomic — Greek yogurt, lentils) and 'meal' (full plate — chicken & quinoa bowl) unless the user has biased toward one via preferKind.
- Don't duplicate existingGoods or items already in recentMeals (rough name match is enough).
- Use realistic UK foods — names someone in the UK could buy or cook. Prefer generic/whole foods over branded items.
- Macros must be plausible from UK CoFID averages.
- whyTags: pick 1–3 from this exact list: ${WHY_TAGS.join(', ')}. Don't invent new tags.
- "name" should include portion (e.g. "Chickpeas, cooked 100g") for ingredients, plate-name for meals (e.g. "Salmon, sweet potato, broccoli").
- Each suggestion's kcal should be ≤ remainingKcal × 1.5 if remainingKcal is provided (so suggestions stay relevant for today).

Variety rules:
- Don't propose 5 high-protein items if the user's existing library already has many. Read the existingGoods kcal/macro distribution and fill gaps.
- Don't propose 5 boring ingredients in a row — alternate ingredient/meal where appropriate.
- Names should be specific. "Chicken salad" weak; "Chicken & avocado salad, 1 portion" strong.

Anti-patterns:
- Generic preachiness ("eat more vegetables") with no concrete item.
- Branded products (avoid "Marks & Spencer chicken salad" — keep it generic).
- Tags that don't match the macros (don't tag "High protein" on a 5g-protein item).`

function buildUserPrompt(input: SuggestFoodsInput): string {
  const lines: string[] = []
  const goods = input.existingGoods ?? []
  if (goods.length > 0) {
    lines.push(`Existing good foods (${goods.length}):`)
    for (const g of goods) {
      lines.push(`  - ${g.name} (${g.kind}, ~${g.kcal} kcal)`)
    }
  } else {
    lines.push('Existing good foods: none yet — this is the user\'s first batch.')
  }
  lines.push('')
  if (input.recentMeals && input.recentMeals.length > 0) {
    lines.push(`Recent meals: ${input.recentMeals.map((m) => m.name).slice(0, 8).join(', ')}`)
  }
  if (typeof input.remainingKcal === 'number') {
    lines.push(`Remaining kcal today: ${input.remainingKcal}`)
  }
  if (input.goalGrams) {
    lines.push(`Goal grams C/P/F per day: ${input.goalGrams.c_g}/${input.goalGrams.p_g}/${input.goalGrams.f_g}`)
  }
  if (input.preferKind && input.preferKind !== 'any') {
    lines.push(`Preferred kind for this batch: ${input.preferKind} (bias 4 of 5 toward this).`)
  }
  lines.push('')
  lines.push('Propose 5 new candidates via the propose_foods tool.')
  return lines.join('\n')
}

const PROPOSE_FOODS_TOOL = {
  name: 'propose_foods',
  description:
    'Return exactly 5 candidate foods to add to the user\'s Good Foods library. Each must be plausible UK food with realistic macros and 1–3 whyTags from the controlled vocabulary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'UK food name with portion or plate name' },
            kcal: { type: 'number' },
            c_g: { type: 'number' },
            p_g: { type: 'number' },
            f_g: { type: 'number' },
            kind: {
              type: 'string',
              enum: FOOD_KINDS as unknown as string[],
            },
            whyTags: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: {
                type: 'string',
                enum: WHY_TAGS as unknown as string[],
              },
            },
          },
          required: ['name', 'kcal', 'c_g', 'p_g', 'f_g', 'kind', 'whyTags'],
        },
      },
    },
    required: ['suggestions'],
  },
}

export const suggestFoods = onCall(
  {
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request): Promise<SuggestFoodsOutput> => {
    requireAllowedUser(request)

    const input = (request.data ?? {}) as SuggestFoodsInput

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

    let response
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 2000,
        system: SYSTEM_PROMPT + dietSystemSuffix(input.diet),
        tools: [PROPOSE_FOODS_TOOL],
        tool_choice: { type: 'tool', name: 'propose_foods' },
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      })
    } catch (err) {
      logger.error('Anthropic call failed', { uid: request.auth.uid, err })
      throw new HttpsError('internal', 'AI provider error. Try again.')
    }

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      logger.error('No tool_use in response', { uid: request.auth.uid })
      throw new HttpsError('internal', 'Unexpected AI response shape.')
    }

    const raw = toolUse.input as { suggestions?: FoodSuggestion[] }
    if (!raw.suggestions || !Array.isArray(raw.suggestions)) {
      logger.warn('Empty suggestions', { uid: request.auth.uid, raw })
      return { suggestions: [] }
    }

    const cleaned: FoodSuggestion[] = raw.suggestions
      .filter((s) => s && typeof s.name === 'string' && typeof s.kcal === 'number')
      .map((s) => ({
        name: String(s.name).slice(0, 120),
        kcal: Math.max(0, Math.round(s.kcal)),
        c_g: Math.max(0, Math.round((s.c_g ?? 0) * 10) / 10),
        p_g: Math.max(0, Math.round((s.p_g ?? 0) * 10) / 10),
        f_g: Math.max(0, Math.round((s.f_g ?? 0) * 10) / 10),
        kind: (FOOD_KINDS as readonly string[]).includes(s.kind as string)
          ? (s.kind as FoodKind)
          : 'ingredient',
        whyTags: Array.isArray(s.whyTags)
          ? s.whyTags.filter((t): t is WhyTag => (WHY_TAGS as readonly string[]).includes(t)).slice(0, 3)
          : [],
      }))

    logger.info('suggestFoods.ok', {
      uid: request.auth.uid,
      count: cleaned.length,
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
    })

    return { suggestions: cleaned }
  },
)
