import { AuthGate } from './components/AuthGate'
import { AppRoutes } from './routes'

function App() {
  return (
    <AuthGate>
      <AppRoutes />
    </AuthGate>
  )
}

export default App
