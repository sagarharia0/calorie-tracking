import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

type DaySummary = {
  date: string
  kcal: number
  c_g: number
  p_g: number
  f_g: number
  alcohol_g: number
  units: number
  mealCount: number
  labels: string[]
  // Capped sample of items for the LLM to reason over swap opportunities.
  // The client should pre-filter to top N flagged items by kcal.
  flaggedItems: Array<{
    name: string
    kcal: number
    c_g: number
    p_g: number
    f_g: number
    mealType: string
  }>
}

type InsightSummaryInput = {
  days: DaySummary[]
  goal: { kcal: number; c_g: number; p_g: number; f_g: number; weeklyUnitsTarget?: number }
}

type SwapOpportunity = {
  itemName: string
  weeklyKcalCost: number
  suggestedSwap: string
  narrative: string
}

type InsightSummaryOutput = {
  whatsWorking: string
  swapOpportunity: SwapOpportunity | null
}

const SYSTEM_PROMPT = `You are a UK-based nutrition coach generating two short narrative cards for a user's weekly Insights screen, based on their last 7 days of logged meals.

Card 1: "What's working" — one positive, factual sentence (≤ 25 words) about a measurable positive trend in the week (e.g. protein consistency, kcal adherence, label-correlated wins). Use real numbers from the data.

Card 2: "Biggest swap opportunity" — identify the single highest-impact recurring item across the week and propose one swap. Compute weeklyKcalCost as the kcal that one swap would save across the days the item appeared. Skip the card entirely (return swapOpportunity: null) if there's no item meaningfully recurring or worth swapping.

Hard rules:
- Use ONLY data the user provided. Don't invent items they didn't log.
- "What's working" must reference an actual number from the input.
- swapOpportunity.narrative ≤ 35 words, references actual frequency ("4 of 7 days").
- Don't be preachy. The user has goals; respect them.
- Don't moralise about food choices. State facts; suggest alternatives.

Fallback when the data is bland (low variance, sparse logging, no clear positive trend):
- Use a neutral, accurate framing for "What's working" rather than inventing a trend.
- Template: "Your week was steady — kcal averaged [X] across [N] logged days." Substitute real X and N where X is the mean kcal across days with mealCount > 0, and N is the count of logged days.
- Variants are fine ("Steady week — 5 logged days, kcal averaged 2,140."), but the rule stands: never claim a trend the numbers don't support.
- Same fallback applies to swapOpportunity: if no item recurs meaningfully, return null. Better empty than fabricated.

Anti-patterns:
- "You should eat more vegetables" (generic).
- Comments on body composition or weight (out of scope).
- Aggregate stats nobody asked for ("you ate 14,500 kcal this week").`

function buildUserPrompt(input: InsightSummaryInput): string {
  const lines: string[] = []
  lines.push(`Goal: ${input.goal.kcal} kcal/day, macros ${input.goal.c_g}/${input.goal.p_g}/${input.goal.f_g}g C/P/F.`)
  if (input.goal.weeklyUnitsTarget) {
    lines.push(`Weekly alcohol units target: ${input.goal.weeklyUnitsTarget}.`)
  }
  lines.push('')
  lines.push('Last 7 days:')
  for (const d of input.days) {
    const labelStr = d.labels.length > 0 ? ` [${d.labels.join(', ')}]` : ''
    const alcoholStr = d.units > 0 ? `, ${d.units.toFixed(1)} units` : ''
    lines.push(`  ${d.date}${labelStr}: ${d.kcal} kcal (${d.c_g}c ${d.p_g}p ${d.f_g}f${alcoholStr}), ${d.mealCount} meals`)
    if (d.flaggedItems.length > 0) {
      for (const it of d.flaggedItems.slice(0, 3)) {
        lines.push(`    · ${it.mealType} item "${it.name}": ${it.kcal} kcal (${it.c_g}c ${it.p_g}p ${it.f_g}f)`)
      }
    }
  }
  lines.push('')
  lines.push('Generate the two narrative cards via the summarize_week tool.')
  return lines.join('\n')
}

const SUMMARIZE_TOOL = {
  name: 'summarize_week',
  description: 'Return narrative copy for the Insights week-summary cards.',
  input_schema: {
    type: 'object' as const,
    properties: {
      whatsWorking: {
        type: 'string',
        description: 'One factual positive sentence (≤ 25 words) referencing real numbers from the data.',
      },
      swapOpportunity: {
        oneOf: [
          { type: 'null' },
          {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              weeklyKcalCost: { type: 'number' },
              suggestedSwap: { type: 'string' },
              narrative: { type: 'string', description: '≤ 35 words.' },
            },
            required: ['itemName', 'weeklyKcalCost', 'suggestedSwap', 'narrative'],
          },
        ],
      },
    },
    required: ['whatsWorking', 'swapOpportunity'],
  },
}

export const insightSummary = onCall(
  {
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request): Promise<InsightSummaryOutput> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.')
    }

    const input = request.data as InsightSummaryInput
    if (!input?.days || !Array.isArray(input.days)) {
      throw new HttpsError('invalid-argument', 'Missing days array.')
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

    let response
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: [SUMMARIZE_TOOL],
        tool_choice: { type: 'tool', name: 'summarize_week' },
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

    const raw = toolUse.input as InsightSummaryOutput
    const result: InsightSummaryOutput = {
      whatsWorking: String(raw.whatsWorking ?? '').slice(0, 300),
      swapOpportunity:
        raw.swapOpportunity && typeof raw.swapOpportunity === 'object'
          ? {
              itemName: String(raw.swapOpportunity.itemName ?? '').slice(0, 100),
              weeklyKcalCost: Math.max(0, Math.round(raw.swapOpportunity.weeklyKcalCost ?? 0)),
              suggestedSwap: String(raw.swapOpportunity.suggestedSwap ?? '').slice(0, 100),
              narrative: String(raw.swapOpportunity.narrative ?? '').slice(0, 400),
            }
          : null,
    }

    logger.info('insightSummary.ok', {
      uid: request.auth.uid,
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
      hasSwap: !!result.swapOpportunity,
    })

    return result
  },
)
