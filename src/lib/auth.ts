import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from './firebase'

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)
export const signOutUser = () => signOut(auth)
export const subscribeToAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb)
