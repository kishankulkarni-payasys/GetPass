import LanguageSwitcher from '../components/LanguageSwitcher'
import NavIcon from '../components/NavIcon'
import PageHeading from '../components/PageHeading'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useSignOut } from '../hooks/useSignOut'
import { initialsOf, roleLabel } from '../navigation/navItems'

export default function AccountPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const signOut = useSignOut()

  return (
    <div className="page-screen account-page">
      <PageHeading kicker={t('headerSectionProfile')} title={t('navAccount')} />

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

      {/* Every role: on phones this is the only place to change the language. */}
      <section className="account-card" aria-labelledby="account-language">
        <h2 id="account-language" className="account-section-title">{t('labelLanguage')}</h2>
        <LanguageSwitcher variant="full" />
      </section>

      <button type="button" className="account-sign-out" onClick={signOut}>
        <NavIcon name="signOut" />
        <span>{t('signOut')}</span>
      </button>
    </div>
  )
}
