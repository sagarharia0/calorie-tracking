import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getDay } from '../lib/repo/days'
import { listMeals } from '../lib/repo/meals'
import { addDays } from '../lib/dateKey'
import type { Day, DateKey, Meal } from '../types/firestore'

export type DayBundle = {
  date: DateKey
  day: Day | null
  meals: Meal[]
}

// One-shot fetch of the last 7 days (oldest → today). Insights doesn't need
// realtime — the user navigates here, sees the snapshot, and moves on. If they
// log a new meal we'll see it next time the screen mounts. Saves us 14 listeners.
export function useLast7Days(today: DateKey | undefined): {
  days: DayBundle[]
  loading: boolean
} {
  const { user } = useAuth()
  const [days, setDays] = useState<DayBundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !today) {
      setDays([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    const dates: DateKey[] = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

    Promise.all(
      dates.map(async (date) => {
        const [day, meals] = await Promise.all([
          getDay(user.uid, date),
          listMeals(user.uid, date),
        ])
        return { date, day, meals } satisfies DayBundle
      }),
    ).then((bundles) => {
      if (!cancelled) {
        setDays(bundles)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [user, today])

  return { days, loading }
}
