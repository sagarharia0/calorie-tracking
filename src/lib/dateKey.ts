import type { DateKey } from '../types/firestore'

export function dateKey(d: Date = new Date()): DateKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayKey = (): DateKey => dateKey(new Date())

export function parseKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

// Display formatters. en-GB locale gives the British "Sun, 4 May" / "Sunday, 4 May"
// ordering (day before month) — matches the design and what the user expects.
// URLs and stored DateKey values stay YYYY-MM-DD; these helpers are for UI only.
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const LONG_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
})

export function formatShortDate(input: DateKey | Date): string {
  return SHORT_DATE_FMT.format(typeof input === 'string' ? parseKey(input) : input)
}

export function formatLongDate(input: DateKey | Date): string {
  return LONG_DATE_FMT.format(typeof input === 'string' ? parseKey(input) : input)
}
