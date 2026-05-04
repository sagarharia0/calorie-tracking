import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { User as FirebaseUser } from 'firebase/auth'
import { db } from '../firebase'
import type { User } from '../../types/firestore'

const userRef = (uid: string) => doc(db, 'users', uid)

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? (snap.data() as User) : null
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
