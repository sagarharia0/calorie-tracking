import { useNavigate, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

type TabId = 'home' | 'insights' | 'labels' | 'settings'

const TABS: { id: TabId; label: string; ic: IconName; path: string }[] = [
  { id: 'home', label: 'Today', ic: 'home', path: '/' },
  { id: 'insights', label: 'Insights', ic: 'chart', path: '/insights' },
  { id: 'labels', label: 'Labels', ic: 'tag', path: '/labels' },
  { id: 'settings', label: 'Goals', ic: 'gear', path: '/goals' },
]

function activeFromPath(pathname: string): TabId {
  if (pathname.startsWith('/insights')) return 'insights'
  if (pathname.startsWith('/labels')) return 'labels'
  if (pathname.startsWith('/goals')) return 'settings'
  return 'home'
}

export function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = activeFromPath(pathname)

  return (
    <div className="tabbar">
      {TABS.map((t) => (
        <div
          key={t.id}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => navigate(t.path)}
          style={{ cursor: 'pointer' }}
        >
          <span className="ic">
            <Icon name={t.ic} size={22} stroke={active === t.id ? 2 : 1.8} />
          </span>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  )
}
