import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, deleteField,
  type Unsubscribe,
} from 'firebase/firestore'
import type { User as FirebaseUser } from 'firebase/auth'
import { db } from '../firebase'
import type { Diet, User } from '../../types/firestore'

const userRef = (uid: string) => doc(db, 'users', uid)

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? (snap.data() as User) : null
}

// Live subscribe to the user profile doc. Used by AuthContext to expose
// editable preferences (currently just `diet`) across the app.
export function subscribeToUser(uid: string, cb: (user: User | null) => void): Unsubscribe {
  return onSnapshot(userRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as User) : null)
  })
}

// Create-if-absent. Idempotent — safe to call on every sign-in.
export async function ensureUser(authUser: FirebaseUser): Promise<void> {
  const ref = userRef(authUser.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    email: authUser.email,
    displayName: authUser.displayName,
    photoURL: authUser.photoURL,
    createdAt: serverTimestamp(),
  })
}

// Set or clear the user's dietary preference. Passing undefined removes the
// field (treated as "no restriction" by the LLM prompt-injection layer).
// Uses setDoc with merge so the write succeeds even if the User doc somehow
// doesn't exist yet (legacy accounts created before ensureUser ran).
export async function setDiet(uid: string, diet: Diet | undefined): Promise<void> {
  if (diet === undefined) {
    await updateDoc(userRef(uid), { diet: deleteField() })
    return
  }
  await setDoc(userRef(uid), { diet }, { merge: true })
}
