import {
  collection, doc, addDoc, getDocs, updateDoc, query, orderBy,
  onSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Label } from '../../types/firestore'

const labelsCol = (uid: string) => collection(db, 'users', uid, 'labels')
const labelRef = (uid: string, id: string) => doc(db, 'users', uid, 'labels', id)

export async function listLabels(uid: string): Promise<Label[]> {
  const snap = await getDocs(query(labelsCol(uid), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Label, 'id'>) }))
}

export async function addLabel(uid: string, data: Omit<Label, 'id'>): Promise<string> {
  const ref = await addDoc(labelsCol(uid), data)
  return ref.id
}

export async function archiveLabel(uid: string, id: string, archived = true): Promise<void> {
  await updateDoc(labelRef(uid, id), { archived })
}

export function subscribeToLabels(uid: string, cb: (labels: Label[]) => void): Unsubscribe {
  return onSnapshot(query(labelsCol(uid), orderBy('name')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Label, 'id'>) })))
  })
}
