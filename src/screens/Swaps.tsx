import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { Icon } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { SizePill, FlagChip } from '../components/ui/SwapBits'
import { useAuth } from '../contexts/AuthContext'
import { useDay } from '../hooks/useDay'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { flagItem } from '../lib/flags'
import { gramsFromGoal } from '../lib/macros'
import { requestSwaps, type SwapSuggestion } from '../lib/cloud'
import { addFood } from '../lib/repo/foods'
import type { MealItem } from '../types/firestore'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ok'; swaps: SwapSuggestion[] }
  | { phase: 'error'; message: string }

export default function Swaps() {
  const { date, mealId, itemIdx } = useParams()
  const navigate = useNavigate()
  const { user, diet } = useAuth()
  const { day, meals, loading: dayLoading } = useDay(date)
  const { goal } = useActiveGoal(date)

  const meal = meals.find((m) => m.id === mealId)
  const idx = Number(itemIdx ?? 0)
  const item: MealItem | undefined = meal?.items[idx]

  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set())
  const [savingIdx, setSavingIdx] = useState<number | null>(null)

  // Fire the LLM call once we have everything we need (item + goal resolved).
  // Dependent on item.name + amount + macros so a re-routed item refetches.
  useEffect(() => {
    if (!item || !meal || dayLoading) return
    let cancelled = false
    setState({ phase: 'loading' })
    setSavedIdxs(new Set())

    const goalKcal = goal?.kcal ?? 2200
    const goalGrams = goal
      ? gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
      : { c_g: 250, p_g: 160, f_g: 70 }
    const remainingKcal = Math.max(0, goalKcal - (day?.totals?.kcal ?? 0))

    requestSwaps({
      item: {
        name: item.name,
        kcal: item.kcal,
        c_g: item.c_g,
        p_g: item.p_g,
        f_g: item.f_g,
        amount: item.amount,
        unit: item.unit,
      },
      mealType: meal.type,
      dailyContext: { remainingKcal, goalGrams },
      ...(diet ? { diet } : {}),
    })
      .then((res) => {
        if (!cancelled) setState({ phase: 'ok', swaps: res.swaps })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'AI provider error.'
        setState({ phase: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [item?.name, item?.kcal, item?.c_g, item?.p_g, item?.f_g, meal?.id, dayLoading, goal?.id, diet])

  const onAccept = async (sIdx: number, swap: SwapSuggestion) => {
    if (!user || savedIdxs.has(sIdx) || savingIdx !== null) return
    setSavingIdx(sIdx)
    try {
      await addFood(user.uid, {
        name: swap.name,
        per100g: {
          // LLM returns absolute macros for the suggested portion. We don't
          // know the portion size, so per100g stores absolute values; future
          // pickers will treat this as a 1-serving food.
          kcal: swap.kcal,
          c_g: swap.c_g,
          p_g: swap.p_g,
          f_g: swap.f_g,
        },
        defaultServing: { qty: 1, unit: 'serving' },
        kind: 'ingredient',
        source: 'llm-suggested',
        useCount: 0,
        lastUsedAt: Timestamp.now(),
      })
      setSavedIdxs((prev) => new Set(prev).add(sIdx))
    } catch (err) {
      window.alert(`Failed to save: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setSavingIdx(null)
    }
  }

  if (dayLoading) {
    return <SheetWrapper onClose={() => navigate(-1)}><CenterMsg>Loading…</CenterMsg></SheetWrapper>
  }

  if (!meal || !item) {
    return (
      <SheetWrapper onClose={() => navigate(-1)}>
        <div className="col gap-8" style={{ padding: '24px 18px' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Item not found</div>
          <div className="muted" style={{ fontSize: 13 }}>
            This meal or item no longer exists. It may have been deleted from another tab.
          </div>
        </div>
      </SheetWrapper>
    )
  }

  const flags = flagItem(item)

  return (
    <Screen label="07 Smart Swaps">
      <div style={{ position: 'relative', flex: 1, background: 'rgba(0,0,0,.35)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', opacity: 0.15 }} />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 8,
            maxHeight: '92%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--hairline-2)' }} />
          </div>

          <div style={{ padding: '8px 18px 14px' }}>
            <div className="row spread aic" style={{ marginBottom: 4 }}>
              <div className="row gap-8 aic">
                <Icon name="sparkle" size={16} color="var(--accent)" />
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Smart swaps</div>
              </div>
              <button onClick={() => navigate(-1)} style={{ border: 0, background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer' }}>
                <Icon name="back" size={20} color="var(--ink-3)" />
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              Comparable alternatives that fit your <b style={{ color: 'var(--ink-2)' }}>{meal.type.toLowerCase()}</b> and remaining macros today.
            </div>
          </div>

          <div style={{ padding: '0 18px 14px' }}>
            <div className="card" style={{ padding: 14, background: 'var(--surface-2)', boxShadow: 'none', border: '1px solid var(--hairline)' }}>
              <div className="section-title" style={{ marginBottom: 8, fontSize: 10.5 }}>You logged</div>
              <div className="row spread aic" style={{ gap: 8, marginBottom: 8 }}>
                <div className="row gap-8 aic" style={{ minWidth: 0 }}>
                  <SizePill kcal={item.kcal} />
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                </div>
                <div className="tnum" style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {item.kcal} <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>kcal</span>
                </div>
              </div>
              <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                {flags.map((f) => <FlagChip key={f} flag={f} />)}
                <span className="pill chip-carbs" style={{ height: 20, fontSize: 10.5 }}>{item.c_g}c</span>
                <span className="pill chip-protein" style={{ height: 20, fontSize: 10.5 }}>{item.p_g}p</span>
                <span className="pill chip-fat" style={{ height: 20, fontSize: 10.5 }}>{item.f_g}f</span>
              </div>
            </div>
          </div>

          <div className="scroll" style={{ flex: 1, padding: '0 18px 24px' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Suggestions</div>
            {state.phase === 'loading' && <LoadingState />}
            {state.phase === 'error' && (
              <ErrorState
                message={state.message}
                onRetry={() => {
                  // Trigger the effect by tickling the state (cheapest re-run).
                  setState({ phase: 'loading' })
                  // Re-fire the LLM call directly.
                  if (!item || !meal) return
                  const goalKcal = goal?.kcal ?? 2200
                  const goalGrams = goal
                    ? gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
                    : { c_g: 250, p_g: 160, f_g: 70 }
                  const remainingKcal = Math.max(0, goalKcal - (day?.totals?.kcal ?? 0))
                  requestSwaps({
                    item: {
                      name: item.name,
                      kcal: item.kcal,
                      c_g: item.c_g,
                      p_g: item.p_g,
                      f_g: item.f_g,
                      amount: item.amount,
                      unit: item.unit,
                    },
                    mealType: meal.type,
                    dailyContext: { remainingKcal, goalGrams },
                    ...(diet ? { diet } : {}),
                  })
                    .then((res) => setState({ phase: 'ok', swaps: res.swaps }))
                    .catch((err) =>
                      setState({
                        phase: 'error',
                        message: err instanceof Error ? err.message : 'AI provider error.',
                      }),
                    )
                }}
              />
            )}
            {state.phase === 'ok' && state.swaps.length === 0 && (
              <div className="muted" style={{ fontSize: 12.5, padding: '12px 4px', lineHeight: 1.5 }}>
                No comparable swaps found for this item — it may already be a solid choice.
              </div>
            )}
            {state.phase === 'ok' &&
              state.swaps.map((s, i) => (
                <SwapCard
                  key={i}
                  original={item}
                  swap={s}
                  saved={savedIdxs.has(i)}
                  saving={savingIdx === i}
                  onAccept={() => onAccept(i, s)}
                />
              ))}
            {state.phase === 'ok' && state.swaps.length > 0 && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8, padding: '0 4px', lineHeight: 1.5 }}>
                Sized <b style={{ color: 'var(--ink-2)' }}>(S / M / L)</b> by portion calories. Tap <b>Save</b> to add a suggestion to your foods library.
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  )
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="muted" style={{ fontSize: 13, padding: '24px 18px', textAlign: 'center' }}>
      {children}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="col gap-10" style={{ padding: '8px 4px' }}>
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
      <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        First call after deploy can take ~10s while the function warms up.
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
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
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, lineHeight: 1.45 }}>{message}</div>
      <button
        onClick={onRetry}
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
  )
}

function SheetWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <Screen label="07 Smart Swaps">
      <div style={{ position: 'relative', flex: 1, background: 'rgba(0,0,0,.35)', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 8,
            maxHeight: '92%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--hairline-2)' }} />
          </div>
          <div className="row spread aic" style={{ padding: '8px 18px' }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Smart swaps</div>
            <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer' }}>
              <Icon name="back" size={20} color="var(--ink-3)" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Screen>
  )
}

function DeltaBar({
  label,
  before,
  after,
  color,
  unit = 'g',
}: {
  label: string
  before: number
  after: number
  color: string
  unit?: string
}) {
  const max = Math.max(before, after, 1)
  const bw = (before / max) * 100
  const aw = (after / max) * 100
  const diff = Math.round((after - before) * 10) / 10
  const better = diff < 0
  return (
    <div className="col" style={{ flex: 1, gap: 3 }}>
      <div className="row spread" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        <span>{label}</span>
        <span
          className="tnum"
          style={{
            color: better
              ? 'color-mix(in oklch, var(--protein), black 28%)'
              : 'color-mix(in oklch, var(--fat), black 30%)',
          }}
        >
          {diff > 0 ? '+' : ''}{diff}{unit}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ width: `${bw}%`, height: '100%', background: 'var(--ink-4)' }} />
        </div>
        <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ width: `${aw}%`, height: '100%', background: color }} />
        </div>
      </div>
    </div>
  )
}

function SwapCard({
  original,
  swap,
  saved,
  saving,
  onAccept,
}: {
  original: MealItem
  swap: SwapSuggestion
  saved: boolean
  saving: boolean
  onAccept: () => void
}) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      <div className="row spread aic" style={{ marginBottom: 12, gap: 8 }}>
        <div className="row gap-8 aic" style={{ minWidth: 0 }}>
          <SizePill kcal={swap.kcal} />
          <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{swap.name}</div>
        </div>
        <div className="tnum" style={{ fontWeight: 700, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {swap.kcal}
          <span className="muted" style={{ fontSize: 11, fontWeight: 500, marginLeft: 3 }}>kcal</span>
        </div>
      </div>
      <div className="row" style={{ gap: 14, marginBottom: 12 }}>
        <DeltaBar label="kcal" before={original.kcal} after={swap.kcal} color="var(--ink-2)" unit="" />
        <DeltaBar label="C" before={original.c_g} after={swap.c_g} color="var(--carbs)" />
        <DeltaBar label="P" before={original.p_g} after={swap.p_g} color="var(--protein)" />
        <DeltaBar label="F" before={original.f_g} after={swap.f_g} color="var(--fat)" />
      </div>
      <div className="row spread aic" style={{ gap: 8 }}>
        <span
          className="pill"
          style={{
            background: 'var(--protein-2)',
            color: 'color-mix(in oklch, var(--protein), black 28%)',
            fontWeight: 700,
            height: 22,
            fontSize: 11,
          }}
        >
          <Icon name="sparkle" size={11} /> {swap.tag}
        </span>
        <button
          onClick={onAccept}
          disabled={saved || saving}
          style={{
            border: 0,
            padding: '0 14px',
            height: 30,
            minWidth: 80,
            background: saved ? 'var(--protein-2)' : 'var(--ink)',
            color: saved ? 'color-mix(in oklch, var(--protein), black 28%)' : '#fff',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 10,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: saved ? 'default' : saving ? 'wait' : 'pointer',
          }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.4 }}>{swap.why}</div>
    </div>
  )
}
