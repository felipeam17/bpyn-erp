// src/components/Layout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { signOut } from '../lib/supabase'
import { useAuth } from '../App'

const NAV = [
  { section: 'Principal' },
  { to: '/dashboard', icon: '◈', label: 'Dashboard' },
  { section: 'Productos' },
  { to: '/catalog',   icon: '▤', label: 'Catálogo' },
  { to: '/import',    icon: '↑', label: 'Importar' },
  { to: '/suppliers',  icon: '⊞', label: 'Proveedores' },
  { section: 'Ventas' },
  { to: '/quotes',    icon: '◉', label: 'Cotizaciones' },
  { section: 'Análisis' },
  { to: '/margins',   icon: '◎', label: 'Márgenes' },
]

export default function Layout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ padding: '16px 20px' }}>
          <img src="/logo.png" alt="Blue Yacht Nautica" style={{ width: 140, height: 'auto' }} />
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <strong>{user?.email?.split('@')[0]}</strong>
          {user?.email}
          <button
            onClick={handleSignOut}
            style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--white-3)', cursor: 'pointer', fontSize: 11, padding: 0 }}
          >
            Cerrar sesión →
          </button>
        </div>
      </aside>

      <div className="main-area">
        <Outlet />
      </div>
    </div>
  )
}
