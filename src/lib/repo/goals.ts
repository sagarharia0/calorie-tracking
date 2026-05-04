import {
  collection, addDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Goal } from '../../types/firestore'

const goalsCol = (uid: string) => collection(db, 'users', uid, 'goals')

export async function listGoals(uid: string): Promise<Goal[]> {
  const snap = await getDocs(query(goalsCol(uid), orderBy('effectiveFrom', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) }))
}

export async function addGoal(uid: string, data: Omit<Goal, 'id'>): Promise<string> {
  const ref = await addDoc(goalsCol(uid), data)
  return ref.id
}

// Active goal on a given date = latest goal where effectiveFrom <= date.
export async function getActiveGoal(uid: string, dateKey: string): Promise<Goal | null> {
  const q = query(
    goalsCol(uid),
    where('effectiveFrom', '<=', dateKey),
    orderBy('effectiveFrom', 'desc'),
    limit(1),
  )
  const snap = await getDocs(q)
  const doc0 = snap.docs[0]
  return doc0 ? { id: doc0.id, ...(doc0.data() as Omit<Goal, 'id'>) } : null
}

export function subscribeToGoals(uid: string, cb: (goals: Goal[]) => void): Unsubscribe {
  return onSnapshot(query(goalsCol(uid), orderBy('effectiveFrom', 'desc')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) })))
  })
}
