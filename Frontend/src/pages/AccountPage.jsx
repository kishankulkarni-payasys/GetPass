import LanguageSwitcher from '../components/LanguageSwitcher'
import NavIcon from '../components/NavIcon'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useSignOut } from '../hooks/useSignOut'
import { ROLES, initialsOf } from '../navigation/navItems'

// Only the guard's role label is translated; other roles always see English.
function roleLabel(role, t) {
  if (role === ROLES.securityGuard) return t('roleSecurityGuard')
  const words = role.split('_')
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export default function AccountPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const signOut = useSignOut()

  return (
    <div className="page-screen account-page">
      <div className="page-heading mb-5">
        <div>
          <p className="page-kicker">ACCOUNT</p>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">{t('navAccount')}</h1>
        </div>
      </div>

      <section className="account-card" aria-labelledby="account-name">
        <div className="account-profile">
          <span className="account-avatar" aria-hidden="true">{initialsOf(user.full_name)}</span>
          <div className="account-identity">
            <h2 id="account-name">{user.full_name}</h2>
            <span>@{user.username}</span>
          </div>
        </div>
        <dl className="record-card-details account-details">
          <div className="record-card-detail">
            <dt>{t('labelRole')}</dt>
            <dd>{roleLabel(user.role, t)}</dd>
          </div>
        </dl>
      </section>

      {user.role === ROLES.securityGuard && (
        <section className="account-card" aria-labelledby="account-language">
          <h2 id="account-language" className="account-section-title">{t('labelLanguage')}</h2>
          <LanguageSwitcher fullWidth />
        </section>
      )}

      <button type="button" className="account-sign-out" onClick={signOut}>
        <NavIcon name="signOut" />
        <span>{t('signOut')}</span>
      </button>
    </div>
  )
}
