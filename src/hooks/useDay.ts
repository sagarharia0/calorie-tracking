import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToDay } from '../lib/repo/days'
import { subscribeToMeals } from '../lib/repo/meals'
import type { Day, Meal, DateKey } from '../types/firestore'

// Live subscription to a single day's doc + its meals subcollection.
// Both stream in via onSnapshot — refresh in one tab, see updates in another.
export function useDay(date: DateKey | undefined) {
  const { user } = useAuth()
  const [day, setDay] = useState<Day | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !date) {
      setLoading(false)
      return
    }
    setLoading(true)
    setDay(null)
    setMeals([])
    let dayLoaded = false
    let mealsLoaded = false
    const checkDone = () => {
      if (dayLoaded && mealsLoaded) setLoading(false)
    }
    const unsubDay = subscribeToDay(user.uid, date, (d) => {
      setDay(d)
      dayLoaded = true
      checkDone()
    })
    const unsubMeals = subscribeToMeals(user.uid, date, (m) => {
      setMeals(m)
      mealsLoaded = true
      checkDone()
    })
    return () => {
      unsubDay()
      unsubMeals()
    }
  }, [user, date])

  return { day, meals, loading }
}
