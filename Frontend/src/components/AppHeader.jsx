import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { initialsOf, pageTitleKeys, roleLabel } from '../navigation/navItems'
import LanguageSwitcher from './LanguageSwitcher'

// Desktop (lg and up) only; MobileTopBar replaces it below lg, where the
// language switcher lives on the Account page instead.
export default function AppHeader() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()

  if (!user) return null

  const { groupKey, titleKey } = pageTitleKeys(user.role, pathname)

  return (
    <header className="app-header">
      <div className="app-header-context">
        {groupKey && (
          <>
            <span className="app-header-eyebrow">{t(groupKey)}</span>
            <span className="app-header-divider" aria-hidden="true">/</span>
          </>
        )}
        <span className="app-header-page">{titleKey ? t(titleKey) : 'GatePass'}</span>
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
