import { useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import {
  listRecentFoods,
  markFoodAsGood,
  searchFoodsByPrefix,
  unmarkFoodAsGood,
} from '../../lib/repo/foods'
import type { Food } from '../../types/firestore'

// Inline picker rendered beneath an item-name input. When `open` is true:
//   - empty `query` → list of recent foods (top 6)
//   - non-empty `query` → prefix matches via the foods.nameLower index
// Picks fire onPick(food). The buttons use onMouseDown + preventDefault so
// the parent input doesn't blur before the click registers.
export function FoodPicker({
  query,
  open,
  onPick,
}: {
  query: string
  open: boolean
  onPick: (f: Food) => void
}) {
  const { user } = useAuth()
  const [results, setResults] = useState<Food[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !open) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const q = query.trim()
    const t = setTimeout(async () => {
      try {
        const list = q.length === 0
          ? await listRecentFoods(user.uid, 6)
          : await searchFoodsByPrefix(user.uid, q, 8)
        if (!cancelled) setResults(list)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, q.length === 0 ? 0 : 180)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [user, query, open])

  if (!open) return null

  const isRecents = query.trim().length === 0
  const showEmpty = !loading && results.length === 0 && isRecents

  if (!showEmpty && results.length === 0) return null

  return (
    <div className="col gap-6" style={{ marginTop: 10 }}>
      <div
        className="muted"
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {isRecents ? 'Recent' : 'Matches'}
      </div>
      {showEmpty ? (
        <div
          className="muted"
          style={{ fontSize: 12, fontWeight: 500, padding: '4px 2px', lineHeight: 1.45 }}
        >
          No saved foods yet. Fill the row, toggle "Save as food", and your library starts here.
        </div>
      ) : (
        <div className="col gap-6">
          {results.map((f) => (
            <PickerRow
              key={f.id}
              f={f}
              onPick={() => onPick(f)}
              onToggleGood={async () => {
                if (!user) return
                if (f.goodFood) {
                  await unmarkFoodAsGood(user.uid, f.id)
                } else {
                  await markFoodAsGood(user.uid, f.id, { markedBy: 'user' })
                }
                // Optimistically update local state so the star reflects immediately
                // (the picker's own listener won't refire — it's not on a snapshot subscription).
                setResults((prev) =>
                  prev.map((r) =>
                    r.id === f.id
                      ? {
                          ...r,
                          goodFood: f.goodFood
                            ? undefined
                            : { markedBy: 'user', pinned: false, whyTags: [], addedAt: Timestamp.now() },
                        }
                      : r,
                  ),
                )
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PickerRow({ f, onPick, onToggleGood }: { f: Food; onPick: () => void; onToggleGood: () => Promise<void> }) {
  const isGood = !!f.goodFood
  const unitSuffix = f.defaultServing?.unit === 'ml' ? 'ml' : 'g'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: '1px solid var(--hairline)',
        background: 'var(--surface-2)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          onPick()
        }}
        style={{
          flex: 1,
          textAlign: 'left',
          border: 0,
          background: 'transparent',
          padding: '10px 12px',
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div className="row spread aic" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </div>
          <div className="muted tnum" style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {Math.round(f.per100g.kcal)} kcal/100{unitSuffix}
            {f.useCount > 0 && ` · ${f.useCount}×`}
          </div>
        </div>
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          // Fire and forget — UI optimistically updates in onToggleGood.
          void onToggleGood()
        }}
        aria-label={isGood ? 'Remove from Good Foods' : 'Mark as Good Food'}
        title={isGood ? 'Remove from Good Foods' : 'Mark as Good Food'}
        style={{
          width: 38,
          border: 0,
          borderLeft: '1px solid var(--hairline)',
          background: isGood ? 'var(--accent)' : 'transparent',
          color: isGood ? '#fff' : 'var(--ink-3)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isGood ? '★' : '☆'}
      </button>
    </div>
  )
}
