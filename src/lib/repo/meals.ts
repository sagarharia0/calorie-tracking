import {
  collection, doc, getDoc, getDocs, query, orderBy,
  onSnapshot, writeBatch, increment, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import { ensureDay } from './days'
import { G_PER_UNIT } from '../macros'
import type { Meal, DateKey } from '../../types/firestore'

const mealsCol = (uid: string, dateKey: DateKey) =>
  collection(db, 'users', uid, 'days', dateKey, 'meals')

const mealRef = (uid: string, dateKey: DateKey, id: string) =>
  doc(db, 'users', uid, 'days', dateKey, 'meals', id)

const dayRef = (uid: string, dateKey: DateKey) => doc(db, 'users', uid, 'days', dateKey)

export async function listMeals(uid: string, dateKey: DateKey): Promise<Meal[]> {
  const snap = await getDocs(query(mealsCol(uid, dateKey), orderBy('time')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meal, 'id'>) }))
}

// Adds a meal and bumps the cached day totals atomically.
// Day doc is ensured first (a no-op when it already exists), so the batch
// always finds a valid target for the increment update.
export async function addMeal(
  uid: string,
  dateKey: DateKey,
  data: Omit<Meal, 'id'>,
): Promise<string> {
  await ensureDay(uid, dateKey)
  const newMealRef = doc(mealsCol(uid, dateKey))
  const alcohol_g = data.alcohol_g ?? 0
  const batch = writeBatch(db)
  batch.set(newMealRef, data)
  batch.update(dayRef(uid, dateKey), {
    'totals.kcal': increment(data.kcal),
    'totals.c_g': increment(data.c_g),
    'totals.p_g': increment(data.p_g),
    'totals.f_g': increment(data.f_g),
    'totals.alcohol_g': increment(alcohol_g),
    'totals.units': increment(alcohol_g / G_PER_UNIT),
    'totals.mealCount': increment(1),
  })
  await batch.commit()
  return newMealRef.id
}

export async function deleteMeal(uid: string, dateKey: DateKey, id: string): Promise<void> {
  const ref = mealRef(uid, dateKey, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const m = snap.data() as Omit<Meal, 'id'>
  const alcohol_g = m.alcohol_g ?? 0
  const batch = writeBatch(db)
  batch.delete(ref)
  batch.update(dayRef(uid, dateKey), {
    'totals.kcal': increment(-m.kcal),
    'totals.c_g': increment(-m.c_g),
    'totals.p_g': increment(-m.p_g),
    'totals.f_g': increment(-m.f_g),
    'totals.alcohol_g': increment(-alcohol_g),
    'totals.units': increment(-alcohol_g / G_PER_UNIT),
    'totals.mealCount': increment(-1),
  })
  await batch.commit()
}

export function subscribeToMeals(
  uid: string, dateKey: DateKey, cb: (meals: Meal[]) => void,
): Unsubscribe {
  return onSnapshot(query(mealsCol(uid, dateKey), orderBy('time')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meal, 'id'>) })))
  })
}
