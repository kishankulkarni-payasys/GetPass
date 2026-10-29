import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useSignOut } from '../hooks/useSignOut'
import { ROLES, ROUTES, initialsOf, roleLabel } from '../navigation/navItems'
import NavIcon from './NavIcon'

const navLinkClasses = ({ isActive }) =>
  `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`

// Desktop (lg and up) only; below lg the bottom tab bar and the mobile top
// bar take over and CSS hides this sidebar.
export default function Sidebar() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const signOut = useSignOut()

  if (!user) return null

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand-row">
        <Link className="app-brand" to={ROUTES.entries} aria-label={t('navHome')}>
          <span className="app-brand-mark" aria-hidden="true">G</span>
          <span lang="en">Gate<span>Pass</span></span>
        </Link>
      </div>

      <div className="app-sidebar-caption">{t('navWorkspace')}</div>
      <nav className="app-navigation" aria-label={t('navMain')}>
        <NavLink to={ROUTES.entries} className={navLinkClasses}>
          <NavIcon name="entries" />
          <span>{t('navVehicleEntries')}</span>
        </NavLink>
        {user.role === ROLES.admin && (
          <NavLink to={ROUTES.users} className={navLinkClasses}>
            <NavIcon name="users" />
            <span>{t('navUserManagement')}</span>
          </NavLink>
        )}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-sidebar-user">
          <div className="app-user-avatar" aria-hidden="true">{initialsOf(user.full_name)}</div>
          <div className="app-sidebar-user-copy">
            <span className="app-sidebar-user-name">{user.full_name}</span>
            <span className="app-sidebar-user-role">{roleLabel(user.role, t)}</span>
          </div>
        </div>
        <button type="button" className="app-logout-button" onClick={signOut}>
          <NavIcon name="signOut" />
          <span>{t('signOut')}</span>
        </button>
      </div>
    </aside>
  )
}
