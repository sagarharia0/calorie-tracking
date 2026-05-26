import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { Icon, type IconName } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { SizePill } from '../components/ui/SwapBits'
import { TabBar } from '../components/ui/TabBar'
import { useAuth } from '../contexts/AuthContext'
import { useDay } from '../hooks/useDay'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { hungerBand } from '../lib/flags'
import { gramsFromGoal } from '../lib/macros'
import {
  addFood,
  setGoodFoodPinned,
  subscribeToGoodFoods,
  unmarkFoodAsGood,
} from '../lib/repo/foods'
import { suggestFoods, type FoodSuggestion, type WhyTag } from '../lib/cloud'
import { todayKey } from '../lib/dateKey'
import type { Food, FoodKind } from '../types/firestore'

type Tab = FoodKind // 'ingredient' | 'meal'
type HungerFilter = 'any' | 'Snack' | 'Light' | 'Main'

type SuggestState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; suggestions: FoodSuggestion[] }
  | { phase: 'error'; message: string }

export default function GoodFoods() {
  const { user, diet } = useAuth()
  const navigate = useNavigate()
  const today = todayKey()
  const { day } = useDay(today)
  const { goal } = useActiveGoal(today)

  const [tab, setTab] = useState<Tab>('ingredient')
  const [hunger, setHunger] = useState<HungerFilter>('any')
  const [foods, setFoods] = useState<Food[] | null>(null)
  const [suggestState, setSuggestState] = useState<SuggestState>({ phase: 'idle' })
  const [acceptedNames, setAcceptedNames] = useState<Set<string>>(new Set())
  const [dismissedNames, setDismissedNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    return subscribeToGoodFoods(user.uid, setFoods)
  }, [user])

  const goalKcal = goal?.kcal ?? 2200
  const goalGrams = goal
    ? gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
    : { c_g: 250, p_g: 160, f_g: 70 }
  const remainingKcal = Math.max(0, goalKcal - (day?.totals?.kcal ?? 0))

  // Sort: pinned first, then by addedAt desc (Firestore already returns in
  // addedAt-desc order; just push pinned to the top).
  const sorted = useMemo(() => {
    if (!foods) return []
    return [...foods].sort((a, b) => {
      const ap = a.goodFood?.pinned ? 1 : 0
      const bp = b.goodFood?.pinned ? 1 : 0
      return bp - ap
    })
  }, [foods])

  const tabbed = sorted.filter((f) => f.kind === tab)
  const hungerFiltered =
    hunger === 'any' ? tabbed : tabbed.filter((f) => hungerBand(f.per100g.kcal) === hunger)

  const counts = {
    ingredient: sorted.filter((f) => f.kind === 'ingredient').length,
    meal: sorted.filter((f) => f.kind === 'meal').length,
  }

  const onSuggest = async () => {
    if (!user || suggestState.phase === 'loading') return
    setSuggestState({ phase: 'loading' })
    setAcceptedNames(new Set())
    setDismissedNames(new Set())
    try {
      const res = await suggestFoods({
        existingGoods: sorted.map((f) => ({
          name: f.name,
          kcal: f.per100g.kcal,
          kind: f.kind,
        })),
        remainingKcal,
        goalGrams,
        preferKind: tab,
        ...(diet ? { diet } : {}),
      })
      setSuggestState({ phase: 'ok', suggestions: res.suggestions })
    } catch (err) {
      setSuggestState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'AI provider error.',
      })
    }
  }

  const onAcceptSuggestion = async (s: FoodSuggestion) => {
    if (!user || acceptedNames.has(s.name)) return
    setAcceptedNames((prev) => new Set(prev).add(s.name))
    try {
      await addFood(user.uid, {
        name: s.name,
        per100g: { kcal: s.kcal, c_g: s.c_g, p_g: s.p_g, f_g: s.f_g },
        defaultServing: { qty: 1, unit: 'serving' },
        kind: s.kind,
        source: 'llm-suggested',
        useCount: 0,
        lastUsedAt: Timestamp.now(),
        goodFood: {
          markedBy: 'ai',
          pinned: false,
          whyTags: s.whyTags,
          addedAt: Timestamp.now(),
        },
      })
    } catch (err) {
      // Roll back so the user can retry.
      setAcceptedNames((prev) => {
        const next = new Set(prev)
        next.delete(s.name)
        return next
      })
      window.alert(`Failed to save: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  const onDismissSuggestion = (name: string) =>
    setDismissedNames((prev) => new Set(prev).add(name))

  const visibleSuggestions =
    suggestState.phase === 'ok'
      ? suggestState.suggestions.filter((s) => !dismissedNames.has(s.name))
      : []

  return (
    <Screen label="08 Good Foods">
      <div className="appbar">
        <button
          className="pill"
          onClick={() => navigate(-1)}
          style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Good foods</div>
        <div style={{ width: 32 }} />
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        <div className="card" style={{ padding: 16, marginBottom: 14, background: 'var(--ink)', color: '#fff', border: 0 }}>
          <div className="row spread aic" style={{ marginBottom: 10 }}>
            <div className="col">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>
                I'm hungry
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3, letterSpacing: '-0.01em' }}>What fits today</div>
            </div>
            <div className="tnum" style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>
              {remainingKcal.toLocaleString()} kcal left
            </div>
          </div>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            {([
              { id: 'any', label: 'Any' },
              { id: 'Snack', label: 'Snack <200' },
              { id: 'Light', label: 'Light 200–400' },
              { id: 'Main', label: 'Main 400+' },
            ] as { id: HungerFilter; label: string }[]).map((b) => (
              <button
                key={b.id}
                onClick={() => setHunger(b.id)}
                style={{
                  border: 0,
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 999,
                  background: hunger === b.id ? '#fff' : 'rgba(255,255,255,.14)',
                  color: hunger === b.id ? 'var(--ink)' : '#fff',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, padding: '0 4px 12px', lineHeight: 1.5 }}>
          <b style={{ color: 'var(--ink-2)' }}>Ingredients</b> appear as direct swaps.{' '}
          <b style={{ color: 'var(--ink-2)' }}>Meals</b> are full plates to cook or order. Mark new foods via{' '}
          <button
            onClick={() => navigate(`/day/${today}/add`)}
            style={{ border: 0, background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
          >
            Log meal
          </button>
          .
        </div>

        <div className="row" style={{ gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 14 }}>
          {([
            { id: 'ingredient', label: `Ingredients · ${counts.ingredient}`, ic: 'leaf' },
            { id: 'meal', label: `Meals · ${counts.meal}`, ic: 'pizza' },
          ] as { id: Tab; label: string; ic: IconName }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                height: 34,
                border: 0,
                borderRadius: 9,
                background: tab === t.id ? '#fff' : 'transparent',
                color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: tab === t.id ? '0 1px 3px rgba(20,28,46,.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name={t.ic} size={13} /> {t.label}
            </button>
          ))}
        </div>

        {foods === null ? (
          <div className="muted" style={{ fontSize: 13, padding: '8px 4px' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="card" style={{ padding: 18 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.55 }}>
              No good foods yet. Log a meal and mark its items as good, or tap{' '}
              <b style={{ color: 'var(--ink-2)' }}>Suggest 5 for me</b> below for AI ideas.
            </div>
          </div>
        ) : hungerFiltered.length === 0 ? (
          <div className="card" style={{ padding: 18 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
              No {tab === 'ingredient' ? 'ingredients' : 'meals'} match the current hunger filter.
            </div>
          </div>
        ) : (
          <div className="col gap-10">
            {hungerFiltered.map((f) => (
              <SavedFoodCard
                key={f.id}
                food={f}
                onTogglePin={async () => {
                  if (!user) return
                  await setGoodFoodPinned(user.uid, f.id, !f.goodFood?.pinned)
                }}
                onUnmark={async () => {
                  if (!user) return
                  if (!window.confirm(`Remove "${f.name}" from Good Foods?`)) return
                  await unmarkFoodAsGood(user.uid, f.id)
                }}
              />
            ))}
          </div>
        )}

        <div style={{ height: 16 }} />

        {suggestState.phase === 'idle' && (
          <button
            onClick={onSuggest}
            className="btn ghost"
            style={{ cursor: 'pointer' }}
          >
            <Icon name="sparkle" size={14} /> Suggest 5 for me
          </button>
        )}

        {suggestState.phase === 'loading' && (
          <div className="card" style={{ padding: 14 }}>
            <div className="row gap-10 aic" style={{ color: 'var(--ink-3)', fontSize: 13, fontWeight: 600 }}>
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid var(--hairline-2)',
                  borderTopColor: 'var(--accent)',
                  display: 'inline-block',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              Asking the LLM…
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {suggestState.phase === 'error' && (
          <div
            className="card"
            style={{
              padding: 14,
              background: 'var(--fat-2)',
              color: 'color-mix(in oklch, var(--fat), black 32%)',
              border: 0,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Couldn't get suggestions</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, lineHeight: 1.45 }}>{suggestState.message}</div>
            <button
              onClick={onSuggest}
              className="pill"
              style={{
                border: 0,
                background: 'var(--ink)',
                color: '#fff',
                height: 28,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {suggestState.phase === 'ok' && (
          <>
            <div className="row spread aic" style={{ padding: '4px 4px 8px', marginTop: 4 }}>
              <div className="section-title">AI suggestions</div>
              <button
                onClick={onSuggest}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Refresh ↻
              </button>
            </div>
            {visibleSuggestions.length === 0 ? (
              <div className="muted" style={{ fontSize: 12.5, padding: '8px 4px' }}>
                All suggestions reviewed. Tap Refresh for another five.
              </div>
            ) : (
              <div className="col gap-10">
                {visibleSuggestions.map((s) => (
                  <SuggestionCard
                    key={s.name}
                    s={s}
                    accepted={acceptedNames.has(s.name)}
                    onAccept={() => onAcceptSuggestion(s)}
                    onDismiss={() => onDismissSuggestion(s.name)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <TabBar />
    </Screen>
  )
}

function SavedFoodCard({
  food,
  onTogglePin,
  onUnmark,
}: {
  food: Food
  onTogglePin: () => Promise<void>
  onUnmark: () => Promise<void>
}) {
  const meta = food.goodFood
  const sourceLabel = meta?.markedBy === 'ai' ? 'AI' : 'You'
  const sourceIcon: IconName = meta?.markedBy === 'ai' ? 'sparkle' : 'edit'
  const sourceBg = meta?.markedBy === 'ai' ? 'var(--accent-2)' : 'var(--surface-2)'
  const sourceFg = meta?.markedBy === 'ai' ? 'var(--accent)' : 'var(--ink-2)'

  return (
    <div className="card" style={{ padding: 14, border: meta?.pinned ? '1px solid var(--accent)' : '1px solid transparent' }}>
      <div className="row spread aic" style={{ marginBottom: 8, gap: 8 }}>
        <div className="row gap-8 aic" style={{ minWidth: 0, flex: 1 }}>
          <SizePill kcal={food.per100g.kcal} />
          <div className="col" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {food.name}
            </div>
            <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1 }}>
              {hungerBand(food.per100g.kcal)} · used {food.useCount}×
            </div>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <div className="tnum" style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
            {food.per100g.kcal}
            <span className="muted" style={{ fontSize: 10.5, fontWeight: 500, marginLeft: 3 }}>kcal</span>
          </div>
          <div className="row gap-4" style={{ marginTop: 4, fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'color-mix(in oklch, var(--carbs), black 30%)' }}>{food.per100g.c_g}c</span>
            <span style={{ color: 'color-mix(in oklch, var(--protein), black 28%)' }}>{food.per100g.p_g}p</span>
            <span style={{ color: 'color-mix(in oklch, var(--fat), black 30%)' }}>{food.per100g.f_g}f</span>
          </div>
        </div>
      </div>
      <div className="row spread aic" style={{ gap: 8 }}>
        <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
          <span
            className="pill"
            style={{
              height: 20,
              fontSize: 10,
              padding: '0 7px',
              background: sourceBg,
              color: sourceFg,
              fontWeight: 700,
            }}
          >
            <Icon name={sourceIcon} size={9} color={sourceFg} /> {sourceLabel}
          </span>
          {meta?.pinned && (
            <span
              className="pill"
              style={{
                height: 20,
                fontSize: 10,
                padding: '0 7px',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              ★ Pinned
            </span>
          )}
          {(meta?.whyTags ?? []).map((w) => (
            <span
              key={w}
              className="pill"
              style={{
                height: 20,
                fontSize: 10,
                padding: '0 7px',
                fontWeight: 700,
                background: 'var(--protein-2)',
                color: 'color-mix(in oklch, var(--protein), black 28%)',
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <div className="row gap-6" style={{ flexShrink: 0 }}>
          <button
            onClick={onTogglePin}
            aria-label={meta?.pinned ? 'Unpin' : 'Pin'}
            className="pill"
            style={{
              border: 0,
              background: meta?.pinned ? 'var(--accent)' : 'var(--surface-2)',
              color: meta?.pinned ? '#fff' : 'var(--ink-3)',
              height: 26,
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {meta?.pinned ? '★' : '☆'}
          </button>
          <button
            onClick={onUnmark}
            aria-label="Remove from Good Foods"
            className="pill"
            style={{
              border: 0,
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
              height: 26,
              width: 26,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <Icon name="trash" size={12} color="var(--ink-3)" />
          </button>
        </div>
      </div>
    </div>
  )
}

function SuggestionCard({
  s,
  accepted,
  onAccept,
  onDismiss,
}: {
  s: FoodSuggestion
  accepted: boolean
  onAccept: () => void
  onDismiss: () => void
}) {
  return (
    <div
      className="card"
      style={{
        padding: 14,
        border: '1px solid var(--accent)',
        background: 'var(--accent-2)',
      }}
    >
      <div className="row spread aic" style={{ marginBottom: 8, gap: 8 }}>
        <div className="row gap-8 aic" style={{ minWidth: 0, flex: 1 }}>
          <SizePill kcal={s.kcal} />
          <div className="col" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </div>
            <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1 }}>
              {hungerBand(s.kcal)} · {s.kind}
            </div>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <div className="tnum" style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
            {s.kcal}
            <span className="muted" style={{ fontSize: 10.5, fontWeight: 500, marginLeft: 3 }}>kcal</span>
          </div>
          <div className="row gap-4" style={{ marginTop: 4, fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'color-mix(in oklch, var(--carbs), black 30%)' }}>{s.c_g}c</span>
            <span style={{ color: 'color-mix(in oklch, var(--protein), black 28%)' }}>{s.p_g}p</span>
            <span style={{ color: 'color-mix(in oklch, var(--fat), black 30%)' }}>{s.f_g}f</span>
          </div>
        </div>
      </div>
      <div className="row spread aic" style={{ gap: 8 }}>
        <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
          {s.whyTags.map((w: WhyTag) => (
            <span
              key={w}
              className="pill"
              style={{
                height: 20,
                fontSize: 10,
                padding: '0 7px',
                fontWeight: 700,
                background: 'var(--protein-2)',
                color: 'color-mix(in oklch, var(--protein), black 28%)',
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <div className="row gap-6" style={{ flexShrink: 0 }}>
          <button
            onClick={onDismiss}
            disabled={accepted}
            className="pill"
            style={{
              border: 0,
              background: 'var(--surface)',
              color: 'var(--ink-3)',
              height: 28,
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: accepted ? 'not-allowed' : 'pointer',
              opacity: accepted ? 0.5 : 1,
            }}
          >
            Dismiss
          </button>
          <button
            onClick={onAccept}
            disabled={accepted}
            className="pill"
            style={{
              border: 0,
              background: accepted ? 'var(--protein-2)' : 'var(--ink)',
              color: accepted ? 'color-mix(in oklch, var(--protein), black 28%)' : '#fff',
              height: 28,
              padding: '0 12px',
              fontSize: 11,
              fontWeight: 700,
              cursor: accepted ? 'default' : 'pointer',
            }}
          >
            {accepted ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
