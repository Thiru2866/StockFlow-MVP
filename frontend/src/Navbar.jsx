import { Link, NavLink, useNavigate } from 'react-router-dom'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/products', label: 'Inventory', icon: '▤' },
  { to: '/suppliers', label: 'Suppliers', icon: '♙' },
  { to: '/reports', label: 'Reports', icon: '▥' },
  { to: '/settings', label: 'Settings', icon: '⚙' }
]

export default function Navbar() {
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <aside className="sidebar">
      <Link className="brand" to="/dashboard" aria-label="StockFlow dashboard">
        <span className="brand-mark">S</span>
        <span className="brand-copy">
          <strong>StockFlow</strong>
          <small>Inventory workspace</small>
        </span>
      </Link>

      <div className="sidebar-divider" />
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <span className="tip-icon" aria-hidden="true">✦</span>
          <strong>Stay in control</strong>
          <p>Keep your stock levels accurate and your team in sync.</p>
        </div>
        <div className="profile-row">
          <div className="profile-avatar" aria-hidden="true">SF</div>
          <div className="profile-copy">
            <strong>Workspace owner</strong>
            <small>Administrator</small>
          </div>
          <button className="sign-out-button" onClick={logout} aria-label="Sign out" title="Sign out">
            ↗
          </button>
        </div>
      </div>
    </aside>
  )
}

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">S</span>
            <strong>StockFlow</strong>
          </div>
          <div className="topbar-context">
            <span className="status-dot" />
            Your inventory workspace
          </div>
          <div className="topbar-account">
            <span className="account-avatar">SF</span>
            <span>Workspace</span>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
