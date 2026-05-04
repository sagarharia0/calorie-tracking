import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './screens/Home'
import Day from './screens/Day'
import AddMeal from './screens/AddMeal'
import Goals from './screens/Goals'
import Labels from './screens/Labels'
import Insights from './screens/Insights'
import Scanner from './screens/Scanner'
import Swaps from './screens/Swaps'
import GoodFoods from './screens/GoodFoods'
import { Screen } from './components/ui/Screen'
import { signOutUser } from './lib/auth'
import { useAuth } from './contexts/AuthContext'

function SignOut() {
  const { user } = useAuth()
  useEffect(() => {
    if (user) signOutUser()
  }, [user])
  if (!user) return <Navigate to="/" replace />
  return (
    <Screen label="signing out">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="muted" style={{ fontSize: 13 }}>Signing out…</div>
      </div>
    </Screen>
  )
}

function NotFound() {
  return (
    <Screen label="404">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Not found</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>This route does not exist.</div>
        </div>
      </div>
    </Screen>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/day/:date" element={<Day />} />
      <Route path="/day/:date/add" element={<AddMeal />} />
      <Route path="/goals" element={<Goals />} />
      <Route path="/labels" element={<Labels />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/swaps/:date/:mealId/:itemIdx" element={<Swaps />} />
      <Route path="/good-foods" element={<GoodFoods />} />
      <Route path="/sign-out" element={<SignOut />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
