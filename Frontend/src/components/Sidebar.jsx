import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const navLinkClasses = ({ isActive }) =>
  `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    try {
      await logout()
      showToast('Logged out successfully', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Logout failed', 'error')
    }
  }

  return (
    <>
      <div className="app-mobile-bar">
        <Link className="app-brand" to="/entries" aria-label="GatePass home">
          <span className="app-brand-mark" aria-hidden="true">G</span>
          <span>Gate<span>Pass</span></span>
        </Link>
        <button
          type="button"
          className="app-menu-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <button
          type="button"
          className="app-nav-scrim"
          onClick={() => setIsOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'app-sidebar-open' : ''}`}>
        <div className="app-sidebar-brand-row">
          <Link className="app-brand" to="/entries" aria-label="GatePass home">
            <span className="app-brand-mark" aria-hidden="true">G</span>
            <span>Gate<span>Pass</span></span>
          </Link>
          <button
            type="button"
            className="app-menu-toggle app-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="app-sidebar-caption">WORKSPACE</div>
        <nav className="app-navigation" aria-label="Main navigation">
          <NavLink to="/entries" onClick={() => setIsOpen(false)} className={navLinkClasses}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7.5h18M6 4.5h12a2 2 0 0 1 2 2v13H4v-13a2 2 0 0 1 2-2Zm2 7h3m-3 4h8" />
            </svg>
            <span>Vehicle entries</span>
          </NavLink>
          {user.role === 'admin' && (
            <NavLink to="/users" onClick={() => setIsOpen(false)} className={navLinkClasses}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-6a4 4 0 0 1 0 7.75M21 20v-1.5a4 4 0 0 0-3-3.87" />
              </svg>
              <span>User management</span>
            </NavLink>
          )}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-user-avatar" aria-hidden="true">
              {user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
            </div>
            <div className="app-sidebar-user-copy">
              <span className="app-sidebar-user-name">{user.full_name}</span>
              <span className="app-sidebar-user-role">{user.role.replaceAll('_', ' ')}</span>
            </div>
          </div>
          <button type="button" className="app-logout-button" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
