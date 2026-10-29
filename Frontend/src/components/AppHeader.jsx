import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { ROUTES, initialsOf, roleLabel } from '../navigation/navItems'
import LanguageSwitcher from './LanguageSwitcher'

const DEFAULT_PAGE = { sectionKey: 'headerSectionOperations', pageKey: 'navVehicleEntries' }

// Matched by path prefix so every /entries/<section> keeps the same header.
const PAGE_DETAILS = [
  { prefix: ROUTES.entries, ...DEFAULT_PAGE },
  { prefix: ROUTES.users, sectionKey: 'headerSectionAdministration', pageKey: 'navUserManagement' },
  { prefix: ROUTES.account, sectionKey: 'headerSectionProfile', pageKey: 'navAccount' },
]

function pageDetailsFor(pathname) {
  return PAGE_DETAILS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ?? DEFAULT_PAGE
}

// Desktop (lg and up) only; MobileTopBar replaces it below lg, where the
// language switcher lives on the Account page instead.
export default function AppHeader() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()

  if (!user) return null

  const { sectionKey, pageKey } = pageDetailsFor(pathname)

  return (
    <header className="app-header">
      <div className="app-header-context">
        <span className="app-header-eyebrow">{t(sectionKey)}</span>
        <span className="app-header-divider" aria-hidden="true">/</span>
        <span className="app-header-page">{t(pageKey)}</span>
      </div>
      <div className="app-header-account">
        <span className="app-header-status"><span aria-hidden="true" /> {t('headerOperationsActive')}</span>
        <LanguageSwitcher />
        <div className="app-header-avatar" aria-hidden="true">{initialsOf(user.full_name)}</div>
        <div className="app-header-user">
          <span className="app-header-name">{user.full_name}</span>
          <span className="app-header-role">{roleLabel(user.role, t)}</span>
        </div>
      </div>
    </header>
  )
}
