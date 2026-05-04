import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  type Day, type DayTotals, type DateKey, ZERO_TOTALS,
} from '../../types/firestore'

const dayRef = (uid: string, dateKey: DateKey) => doc(db, 'users', uid, 'days', dateKey)

export async function getDay(uid: string, dateKey: DateKey): Promise<Day | null> {
  const snap = await getDoc(dayRef(uid, dateKey))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Day, 'id'>) }
}

// Create the day doc if missing. Safe to call repeatedly.
export async function ensureDay(uid: string, dateKey: DateKey): Promise<void> {
  const ref = dayRef(uid, dateKey)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    date: dateKey,
    labelIds: [],
    totals: ZERO_TOTALS,
  })
}

export async function setDayTotals(uid: string, dateKey: DateKey, totals: DayTotals): Promise<void> {
  await updateDoc(dayRef(uid, dateKey), { totals })
}

export async function setDayLabels(uid: string, dateKey: DateKey, labelIds: string[]): Promise<void> {
  await updateDoc(dayRef(uid, dateKey), { labelIds })
}

export function subscribeToDay(
  uid: string, dateKey: DateKey, cb: (day: Day | null) => void,
): Unsubscribe {
  return onSnapshot(dayRef(uid, dateKey), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Day, 'id'>) } : null)
  })
}
