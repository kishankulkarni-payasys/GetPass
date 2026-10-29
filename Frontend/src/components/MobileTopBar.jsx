import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { ROUTES, findActiveTab, initialsOf, tabLabel, tabsForRole } from '../navigation/navItems'

// Mobile-only (below lg) header: brand, current page title, account shortcut.
// Replaces both the desktop AppHeader and the sidebar on phones and tablets.
export default function MobileTopBar() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()

  if (!user) return null

  const activeTab = findActiveTab(tabsForRole(user.role), pathname)
  // Brand name, never translated, for routes without a tab.
  const title = activeTab ? tabLabel(activeTab, t) : 'GatePass'

  return (
    <header className="mobile-top-bar">
      <Link className="mobile-top-bar-brand" to={ROUTES.entries} aria-label={t('navHome')}>
        <span className="app-brand-mark" aria-hidden="true">G</span>
      </Link>
      <h1 className="mobile-top-bar-title">{title}</h1>
      <Link className="mobile-top-bar-avatar" to={ROUTES.account} aria-label={t('navAccount')}>
        <span aria-hidden="true">{initialsOf(user.full_name)}</span>
      </Link>
    </header>
  )
}
