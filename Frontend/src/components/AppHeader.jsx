import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { initialsOf, roleLabel } from '../navigation/navItems'
import Breadcrumbs from './Breadcrumbs'
import LanguageSwitcher from './LanguageSwitcher'

// Desktop (lg and up) only; MobileTopBar replaces it below lg, where the
// language switcher lives on the Account page instead.
export default function AppHeader() {
  const { user } = useAuth()
  const { t } = useLanguage()

  if (!user) return null

  const userRoleLabel = roleLabel(user.role, t)

  return (
    <header className="app-header">
      <Breadcrumbs />
      <div className="app-header-account">
        <span className="app-header-status"><span aria-hidden="true" /> {t('headerOperationsActive')}</span>
        <LanguageSwitcher />
        <div className="app-header-avatar" aria-hidden="true">{initialsOf(user.full_name)}</div>
        <div className="app-header-user">
          {/* Both can be ellipsis-truncated in the desktop header, so the title shows the full value on hover. */}
          <span className="app-header-name" title={user.full_name}>{user.full_name}</span>
          <span className="app-header-role" title={userRoleLabel}>{userRoleLabel}</span>
        </div>
      </div>
    </header>
  )
}
