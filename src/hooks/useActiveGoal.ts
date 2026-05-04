import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToGoals } from '../lib/repo/goals'
import type { Goal, DateKey } from '../types/firestore'

// Subscribes to the user's full goal history (sorted desc by effectiveFrom)
// and resolves the active goal for a given date as a derived value.
// Returns the full list too — callers like the Goals screen need both.
export function useActiveGoal(date: DateKey | undefined) {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[] | null>(null)

  useEffect(() => {
    if (!user) {
      setGoals(null)
      return
    }
    return subscribeToGoals(user.uid, setGoals)
  }, [user])

  const goal = useMemo(() => {
    if (!goals || !date) return null
    return goals.find((g) => g.effectiveFrom <= date) ?? null
  }, [goals, date])

  return { goal, goals: goals ?? [], loading: goals === null }
}
