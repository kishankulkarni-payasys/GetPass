import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useSignOut } from '../hooks/useSignOut'
import { ROUTES, initialsOf, roleLabel, sidebarGroupsForRole, tabLabel } from '../navigation/navItems'
import NavIcon from './NavIcon'

const navLinkClasses = ({ isActive }) =>
  `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`

function SidebarGroup({ labelKey, tabs, t }) {
  const label = t(labelKey)
  return (
    <>
      <div className="app-sidebar-caption" aria-hidden="true">{label}</div>
      <nav className="app-navigation" aria-label={label}>
        {tabs.map((tab) => (
          <NavLink key={tab.id} to={tab.to} className={navLinkClasses}>
            <NavIcon name={tab.icon} />
            <span>{tabLabel(tab, t)}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}

// Desktop (lg and up) only; below lg the bottom tab bar and the mobile top
// bar take over and CSS hides this sidebar. Lists every section the role
// may open, grouped, so desktop needs no second row of section tabs.
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

      {sidebarGroupsForRole(user.role).map(({ group, labelKey, tabs }) => (
        <SidebarGroup key={group} labelKey={labelKey} tabs={tabs} t={t} />
      ))}

      <div className="app-sidebar-footer">
        <Link to={ROUTES.account} className="app-sidebar-user" title={t('navAccount')}>
          <div className="app-user-avatar" aria-hidden="true">{initialsOf(user.full_name)}</div>
          <div className="app-sidebar-user-copy">
            <span className="app-sidebar-user-name">{user.full_name}</span>
            <span className="app-sidebar-user-role">{roleLabel(user.role, t)}</span>
          </div>
        </Link>
        <button type="button" className="app-logout-button" onClick={signOut}>
          <NavIcon name="signOut" />
          <span>{t('signOut')}</span>
        </button>
      </div>
    </aside>
  )
}
