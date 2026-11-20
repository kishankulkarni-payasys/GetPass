import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBreadcrumbTrail } from '../context/BreadcrumbContext'
import { useLanguage } from '../context/LanguageContext'
import { parentCrumb } from '../navigation/breadcrumbs'
import { ROUTES, initialsOf, pageTitleKeys } from '../navigation/navItems'
import NavIcon from './NavIcon'
import './Breadcrumbs.css'

// Detail pages (pass, return out-pass, GRN editor) swap the brand mark for a
// back arrow to their parent crumb; section pages rely on the bottom tab bar.
function TopBarStart() {
  const { t } = useLanguage()
  const parent = parentCrumb(useBreadcrumbTrail())

  if (!parent) {
    return (
      <Link className="mobile-top-bar-brand" to={ROUTES.entries} aria-label={t('navHome')}>
        <span className="app-brand-mark" aria-hidden="true">G</span>
      </Link>
    )
  }
  return (
    <Link className="mobile-top-bar-back no-print" to={parent.to} aria-label={t('breadcrumbBackTo', { page: parent.label })}>
      <NavIcon name="back" className="mobile-top-bar-back-icon" />
    </Link>
  )
}

// Mobile-only (below lg) header: brand or back arrow, current page title,
// account shortcut. Replaces both the desktop AppHeader and the sidebar on phones and tablets.
export default function MobileTopBar() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()

  if (!user) return null

  const { titleKey } = pageTitleKeys(user.role, pathname)
  // Brand name, never translated, for routes without a title.
  const title = titleKey ? t(titleKey) : 'GatePass'

  return (
    <header className="mobile-top-bar">
      <TopBarStart />
      <h1 className="mobile-top-bar-title">{title}</h1>
      <Link className="mobile-top-bar-avatar" to={ROUTES.account} aria-label={t('navAccount')}>
        <span aria-hidden="true">{initialsOf(user.full_name)}</span>
      </Link>
    </header>
  )
}
