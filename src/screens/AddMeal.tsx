import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { Icon, type IconName } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { FoodPicker } from '../components/forms/FoodPicker'
import { useAuth } from '../contexts/AuthContext'
import { addMeal } from '../lib/repo/meals'
import { addFood, bumpFoodUse } from '../lib/repo/foods'
import { todayKey, parseKey } from '../lib/dateKey'
import type { AmountUnit, Food, MealItem, MealType } from '../types/firestore'

const MEAL_TYPES: { type: MealType; icon: IconName }[] = [
  { type: 'Breakfast', icon: 'sun' },
  { type: 'Lunch', icon: 'pizza' },
  { type: 'Dinner', icon: 'moon' },
  { type: 'Snack', icon: 'cookie' },
  { type: 'Drink', icon: 'cup' },
]

const UNITS: AmountUnit[] = ['g', 'ml', 'serving']

type ItemDraft = {
  name: string
  amount: string
  unit: AmountUnit
  kcal: string
  c_g: string
  p_g: string
  f_g: string
  foodId?: string
  barcode?: string
  saveAsFood: boolean
}

const emptyDraft = (): ItemDraft => ({
  name: '',
  amount: '',
  unit: 'g',
  kcal: '',
  c_g: '',
  p_g: '',
  f_g: '',
  saveAsFood: false,
})

// Prefill shape passed by Scanner via router state.
type Prefill = {
  name: string
  barcode?: string
  amount: number
  unit: AmountUnit
  kcal: number
  c_g: number
  p_g: number
  f_g: number
}

const prefillToDraft = (p: Prefill): ItemDraft => ({
  name: p.name,
  amount: String(p.amount),
  unit: p.unit,
  kcal: String(Math.round(p.kcal)),
  c_g: String(Math.round(p.c_g)),
  p_g: String(Math.round(p.p_g)),
  f_g: String(Math.round(p.f_g)),
  barcode: p.barcode,
  saveAsFood: false,
})

const toInt = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}
const toNum = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

// Round to 1 decimal place; Firestore is fine with floats but keeps the doc readable.
const round1 = (n: number) => Math.round(n * 10) / 10

export default function AddMeal() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { date } = useParams()
  const dateKey = date ?? todayKey()

  // Prefill from Scanner (router state) seeds the first item row.
  const prefill = (location.state as { prefill?: Prefill } | null)?.prefill

  const [type, setType] = useState<MealType>('Snack')
  const [items, setItems] = useState<ItemDraft[]>(() =>
    prefill ? [prefillToDraft(prefill)] : [emptyDraft()],
  )
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const updateItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const addItemRow = () => setItems((prev) => [...prev, emptyDraft()])
  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length === 1 ? [emptyDraft()] : prev.filter((_, i) => i !== idx)))

  // Editing the name detaches the row from its picked food (if any) — the food
  // was a prefill source, not a binding. Macro/amount edits keep the link, so
  // useCount still bumps when user saves with a tweaked amount.
  const onNameChange = (idx: number, name: string) =>
    updateItem(idx, { name, foodId: undefined })

  const onPickFood = (idx: number, f: Food) => {
    const current = items[idx]
    const fallbackQty = f.defaultServing?.qty ?? 100
    const fallbackUnit: AmountUnit = f.defaultServing?.unit ?? 'g'
    const amt = toNum(current.amount) || fallbackQty
    const unit: AmountUnit = current.amount ? current.unit : fallbackUnit
    const factor = unit === 'serving' ? 1 : amt / 100
    updateItem(idx, {
      name: f.name,
      amount: String(amt),
      unit,
      kcal: String(Math.round(f.per100g.kcal * factor)),
      c_g: String(Math.round(f.per100g.c_g * factor)),
      p_g: String(Math.round(f.per100g.p_g * factor)),
      f_g: String(Math.round(f.per100g.f_g * factor)),
      foodId: f.id,
      saveAsFood: false,
    })
    setFocusIdx(null)
  }

  const parsedItems: MealItem[] = items
    .filter((it) => it.name.trim().length > 0)
    .map((it) => ({
      name: it.name.trim(),
      amount: toNum(it.amount),
      unit: it.unit,
      kcal: toInt(it.kcal),
      c_g: toInt(it.c_g),
      p_g: toInt(it.p_g),
      f_g: toInt(it.f_g),
      ...(it.foodId ? { foodId: it.foodId } : {}),
      ...(it.barcode ? { barcode: it.barcode } : {}),
    }))

  const totals = parsedItems.reduce(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      c_g: acc.c_g + it.c_g,
      p_g: acc.p_g + it.p_g,
      f_g: acc.f_g + it.f_g,
    }),
    { kcal: 0, c_g: 0, p_g: 0, f_g: 0 },
  )

  const canSave = !saving && parsedItems.length > 0 && totals.kcal > 0 && !!user

  const onSave = async () => {
    if (!user || !canSave) return
    setSaving(true)
    setErr(null)
    try {
      // 1. For drafts marked "Save as food" (no existing foodId, g/ml unit):
      //    addFood first so the resulting foodId can be linked into the meal.
      // 2. Already-picked foodIds get bumped after the meal write so useCount tracks usage.
      const itemsToWrite: MealItem[] = []
      const bumpIds: string[] = []
      for (const draft of items) {
        const trimmedName = draft.name.trim()
        if (trimmedName.length === 0) continue
        const amt = toNum(draft.amount)
        const base: MealItem = {
          name: trimmedName,
          amount: amt,
          unit: draft.unit,
          kcal: toInt(draft.kcal),
          c_g: toInt(draft.c_g),
          p_g: toInt(draft.p_g),
          f_g: toInt(draft.f_g),
          ...(draft.barcode ? { barcode: draft.barcode } : {}),
        }
        if (draft.foodId) {
          itemsToWrite.push({ ...base, foodId: draft.foodId })
          bumpIds.push(draft.foodId)
          continue
        }
        const eligibleSave =
          draft.saveAsFood &&
          (draft.unit === 'g' || draft.unit === 'ml') &&
          amt > 0 &&
          base.kcal > 0
        if (eligibleSave) {
          const factor = 100 / amt
          const newId = await addFood(user.uid, {
            name: trimmedName,
            ...(draft.barcode ? { barcode: draft.barcode } : {}),
            per100g: {
              kcal: round1(base.kcal * factor),
              c_g: round1(base.c_g * factor),
              p_g: round1(base.p_g * factor),
              f_g: round1(base.f_g * factor),
            },
            defaultServing: { qty: amt, unit: draft.unit },
            kind: 'ingredient',
            // Barcode-prefilled rows came from OFF; otherwise manual entry.
            source: draft.barcode ? 'barcode' : 'manual',
            useCount: 1,
            lastUsedAt: Timestamp.now(),
          })
          itemsToWrite.push({ ...base, foodId: newId })
        } else {
          itemsToWrite.push(base)
        }
      }

      await addMeal(user.uid, dateKey, {
        type,
        time: Timestamp.now(),
        kcal: totals.kcal,
        c_g: totals.c_g,
        p_g: totals.p_g,
        f_g: totals.f_g,
        items: itemsToWrite,
      })

      // Pre-existing foodIds: bump useCount + lastUsedAt.
      // Newly created foods already have useCount 1 from addFood.
      for (const id of bumpIds) {
        await bumpFoodUse(user.uid, id)
      }

      navigate(dateKey === todayKey() ? '/' : `/day/${dateKey}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save meal')
      setSaving(false)
    }
  }

  const dateObj = parseKey(dateKey)
  const dateLabel =
    dateKey === todayKey()
      ? 'Today'
      : dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <Screen label="Add meal">
      <div className="appbar">
        <button
          className="pill"
          onClick={() => navigate(-1)}
          style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div className="col aic" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Log meal</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{dateLabel}</div>
        </div>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="pill"
          style={{
            border: 0,
            height: 32,
            padding: '0 12px',
            background: 'transparent',
            color: canSave ? 'var(--accent)' : 'var(--ink-4)',
            fontWeight: 700,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        {err && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              padding: 12,
              background: 'var(--fat-2)',
              color: 'color-mix(in oklch, var(--fat), black 32%)',
              border: 0,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {err}
          </div>
        )}

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Meal type</div>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            {MEAL_TYPES.map((mt) => {
              const active = type === mt.type
              return (
                <button
                  key={mt.type}
                  onClick={() => setType(mt.type)}
                  className="pill"
                  style={{
                    border: 0,
                    height: 32,
                    padding: '0 12px',
                    background: active ? 'var(--ink)' : 'var(--surface-2)',
                    color: active ? '#fff' : 'var(--ink-2)',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  <Icon name={mt.icon} size={13} color={active ? '#fff' : 'var(--ink-2)'} />
                  {mt.type}
                </button>
              )
            })}
          </div>
        </div>

        <div className="row spread aic" style={{ padding: '4px 4px 8px' }}>
          <div className="section-title">Items</div>
          <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
            {parsedItems.length} ready
          </span>
        </div>

        <div className="col gap-10" style={{ marginBottom: 14 }}>
          {items.map((it, i) => (
            <ItemRow
              key={i}
              draft={it}
              focused={focusIdx === i}
              onFocus={() => setFocusIdx(i)}
              onBlur={() => setFocusIdx((curr) => (curr === i ? null : curr))}
              onNameChange={(name) => onNameChange(i, name)}
              onChange={(patch) => updateItem(i, patch)}
              onPickFood={(f) => onPickFood(i, f)}
              onRemove={() => removeItem(i)}
              removable={items.length > 1}
            />
          ))}
        </div>

        <button
          onClick={addItemRow}
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: '1px dashed var(--hairline-2)',
            background: 'transparent',
            boxShadow: 'none',
            color: 'var(--ink-3)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 14,
            padding: 14,
          }}
        >
          <Icon name="plus" size={14} /> Add another item
        </button>

        <div className="card" style={{ padding: 16 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Meal total</div>
          <div className="row spread aib" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {totals.kcal}
            </div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>kcal</div>
          </div>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            <span className="pill chip-carbs" style={{ height: 22, fontSize: 11.5 }}>{totals.c_g}g C</span>
            <span className="pill chip-protein" style={{ height: 22, fontSize: 11.5 }}>{totals.p_g}g P</span>
            <span className="pill chip-fat" style={{ height: 22, fontSize: 11.5 }}>{totals.f_g}g F</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}

function ItemRow({
  draft,
  focused,
  onFocus,
  onBlur,
  onNameChange,
  onChange,
  onPickFood,
  onRemove,
  removable,
}: {
  draft: ItemDraft
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  onNameChange: (name: string) => void
  onChange: (patch: Partial<ItemDraft>) => void
  onPickFood: (f: Food) => void
  onRemove: () => void
  removable: boolean
}) {
  const amt = toNum(draft.amount)
  const k = toInt(draft.kcal)
  const saveEligible =
    !draft.foodId &&
    draft.name.trim().length > 0 &&
    (draft.unit === 'g' || draft.unit === 'ml') &&
    amt > 0 &&
    k > 0

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row spread aic" style={{ marginBottom: 10, gap: 8 }}>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Item name (e.g. Apple)"
          className="input"
          style={{ flex: 1 }}
        />
        {removable && (
          <button
            onClick={onRemove}
            aria-label="Remove item"
            className="pill"
            style={{
              border: 0,
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
              height: 36,
              width: 36,
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="minus" size={14} color="var(--ink-3)" />
          </button>
        )}
      </div>

      <FoodPicker query={draft.name} open={focused} onPick={onPickFood} />

      {draft.foodId && (
        <div
          className="row gap-6 aic"
          style={{
            marginTop: 8,
            marginBottom: 4,
            padding: '4px 8px',
            background: 'var(--accent-2)',
            color: 'var(--accent)',
            borderRadius: 999,
            width: 'fit-content',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Icon name="check" size={11} color="var(--accent)" /> Linked to saved food
        </div>
      )}

      <div className="row gap-8" style={{ marginTop: 12, marginBottom: 10 }}>
        <div className="col" style={{ flex: 1 }}>
          <FieldLabel>Amount</FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="150"
            className="input"
          />
        </div>
        <div className="col" style={{ flex: 1 }}>
          <FieldLabel>Unit</FieldLabel>
          <select
            value={draft.unit}
            onChange={(e) => onChange({ unit: e.target.value as AmountUnit })}
            className="input"
            style={{ paddingRight: 8 }}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <NumField label="kcal" value={draft.kcal} onChange={(v) => onChange({ kcal: v })} />
        <NumField label="Carbs (g)" value={draft.c_g} onChange={(v) => onChange({ c_g: v })} />
        <NumField label="Protein (g)" value={draft.p_g} onChange={(v) => onChange({ p_g: v })} />
        <NumField label="Fat (g)" value={draft.f_g} onChange={(v) => onChange({ f_g: v })} />
      </div>

      {saveEligible && (
        <button
          onClick={() => onChange({ saveAsFood: !draft.saveAsFood })}
          className="row gap-8 aic"
          style={{
            marginTop: 12,
            border: 0,
            background: 'transparent',
            padding: '4px 2px',
            cursor: 'pointer',
            color: draft.saveAsFood ? 'var(--accent)' : 'var(--ink-3)',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              border: `2px solid ${draft.saveAsFood ? 'var(--accent)' : 'var(--ink-4)'}`,
              background: draft.saveAsFood ? 'var(--accent)' : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {draft.saveAsFood && <Icon name="check" size={11} color="#fff" />}
          </span>
          Save as food
          <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>
            (adds to your library, scaled per 100{draft.unit})
          </span>
        </button>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="muted"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="col" style={{ flex: '1 1 calc(50% - 4px)', minWidth: 100 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="input"
      />
    </div>
  )
}
