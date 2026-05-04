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
