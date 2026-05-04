import {
  collection, doc, addDoc, deleteDoc, getDoc, getDocs, updateDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, deleteField, increment, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Food, GoodFoodMeta } from '../../types/firestore'

const foodsCol = (uid: string) => collection(db, 'users', uid, 'foods')
const foodRef = (uid: string, id: string) => doc(db, 'users', uid, 'foods', id)

export async function getFood(uid: string, id: string): Promise<Food | null> {
  const snap = await getDoc(foodRef(uid, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Food, 'id'>) }
}

export async function listRecentFoods(uid: string, n = 20): Promise<Food[]> {
  const snap = await getDocs(query(foodsCol(uid), orderBy('lastUsedAt', 'desc'), limit(n)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Food, 'id'>) }))
}

// Prefix search by lowercased name. Requires writes to set `nameLower`
// alongside `name` — handled by addFood below.
// Upper bound uses U+F8FF (high BMP private-use code point) as a sentinel
// so the range matches "everything starting with prefix".
export async function searchFoodsByPrefix(uid: string, prefix: string, n = 10): Promise<Food[]> {
  const p = prefix.toLowerCase()
  if (!p) return []
  const q = query(
    foodsCol(uid),
    where('nameLower', '>=', p),
    where('nameLower', '<=', p + ''),
    orderBy('nameLower'),
    limit(n),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Food, 'id'>) }))
}

export async function addFood(uid: string, data: Omit<Food, 'id'>): Promise<string> {
  const ref = await addDoc(foodsCol(uid), {
    ...data,
    nameLower: data.name.toLowerCase(),
    lastUsedAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteFood(uid: string, id: string): Promise<void> {
  await deleteDoc(foodRef(uid, id))
}

// Bump useCount and lastUsedAt — call when this food gets logged into a meal.
export async function bumpFoodUse(uid: string, id: string): Promise<void> {
  await updateDoc(foodRef(uid, id), {
    useCount: increment(1),
    lastUsedAt: serverTimestamp(),
  })
}

// ─── Good Foods ────────────────────────────────────────────────

// Add or replace the goodFood meta on an existing food. Pinned defaults false.
export async function markFoodAsGood(
  uid: string,
  id: string,
  opts: { markedBy: GoodFoodMeta['markedBy']; whyTags?: string[]; pinned?: boolean },
): Promise<void> {
  await updateDoc(foodRef(uid, id), {
    goodFood: {
      markedBy: opts.markedBy,
      pinned: opts.pinned ?? false,
      whyTags: opts.whyTags ?? [],
      addedAt: serverTimestamp(),
    },
  })
}

// Strip the goodFood field. Filter queries (`orderBy('goodFood.addedAt')`)
// will then exclude this food.
export async function unmarkFoodAsGood(uid: string, id: string): Promise<void> {
  await updateDoc(foodRef(uid, id), { goodFood: deleteField() })
}

export async function setGoodFoodPinned(uid: string, id: string, pinned: boolean): Promise<void> {
  await updateDoc(foodRef(uid, id), { 'goodFood.pinned': pinned })
}

// Live subscribe to all good foods, newest-first by addedAt. Pinned-first
// ordering happens client-side (Firestore can't combine two orderBys here
// without a composite index — and `pinned` is a low-cardinality bool, so
// client sort is fine).
export function subscribeToGoodFoods(
  uid: string,
  cb: (foods: Food[]) => void,
): Unsubscribe {
  const q = query(foodsCol(uid), orderBy('goodFood.addedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Food, 'id'>) })))
  })
}
