import { BarChart3, CalendarDays, Dumbbell, Settings2 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppState } from './AppContext'

const navItems = [
  { to: '/hoy', label: 'Hoy', icon: Dumbbell },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/analiticas', label: 'Analíticas', icon: BarChart3 },
  { to: '/ajustes', label: 'Ajustes', icon: Settings2 }
]

export function AppLayout(): JSX.Element {
  const { setup, state } = useAppState()
  const syncLabel = state.sync.enabled ? state.sync.status : 'Local'
  return (
    <div className="app-shell-v3">
      <aside className="desktop-rail">
        <div className="brand-lockup"><span>SBS</span><strong>Strength</strong><small>Reps To Failure</small></div>
        <nav aria-label="Navegación principal">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={20} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-meta"><span>{setup.frequency}× semana</span><span>{setup.units}</span><span>{syncLabel}</span></div>
      </aside>
      <div className="app-stage">
        <header className="mobile-topbar">
          <div className="brand-lockup"><span>SBS</span><strong>Strength</strong></div>
          <div className="topbar-meta"><span>{setup.frequency}×</span><span>{setup.units}</span></div>
        </header>
        <Outlet />
      </div>
      <nav className="mobile-bottom-nav" aria-label="Navegación principal">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={21} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
