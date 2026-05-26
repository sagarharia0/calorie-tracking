// Shared dietary-preference prompt-injection helper.
//
// User chose a deliberately *loose* "flesh-only" filter: exclude meat, poultry,
// and fish as PRIMARY ingredients but tolerate trace amounts of gelatin,
// rennet, anchovies in condiments, etc. The reasoning: swap suggestions are
// inspiration, not mandates — the user is the final judge of what they buy or
// cook. Strict ingredient-by-ingredient compliance would narrow the suggestion
// pool excessively for marginal benefit.
//
// If outputs feel too restrictive in practice, the trace-tolerance clause can
// be removed without breaking anything else.

export type Diet = 'vegetarian' | 'vegan' | 'pescatarian'

const SENTENCES: Record<Diet, string> = {
  vegetarian:
    'DIETARY CONSTRAINT: The user follows a vegetarian diet. Do not propose foods where meat, poultry, or fish is a primary ingredient. Trace or hidden ingredients (gelatin, rennet, fish sauce in condiments, anchovies in Worcestershire) are acceptable — focus on excluding flesh-based foods, not strict ingredient-by-ingredient compliance.',
  vegan:
    'DIETARY CONSTRAINT: The user follows a vegan diet. Do not propose foods where meat, poultry, fish, dairy, eggs, or honey is a primary ingredient. Trace or hidden ingredients in condiments are acceptable — focus on excluding the major animal-product categories, not strict ingredient-by-ingredient compliance.',
  pescatarian:
    'DIETARY CONSTRAINT: The user follows a pescatarian diet. Do not propose foods where meat or poultry is a primary ingredient. Fish and seafood are permitted. Trace or hidden ingredients in condiments are acceptable.',
}

// Return a single sentence to append to a system prompt, or empty string when
// no diet is set (preserves current behaviour for unrestricted users).
export function dietSystemSuffix(diet: Diet | undefined): string {
  if (!diet) return ''
  return '\n\n' + SENTENCES[diet]
}
