import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiErrorMessage } from '../i18n/apiErrors'

// No user yet, so the language comes from the device's stored choice.
export default function LoginPage() {
  const { user, login } = useAuth()
  const { t } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/entries" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const loggedInUser = await login(username, password)
      showToast(t('toastWelcome', { name: loggedInUser.full_name }), 'success')
      navigate('/entries')
    } catch (err) {
      showToast(apiErrorMessage(err, t, 'loginFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <header className="login-header">
        <Link className="app-brand app-brand-light" to="/login" aria-label={t('loginHomeAria')}>
          <span className="app-brand-mark" aria-hidden="true">G</span>
          <span lang="en">Gate<span>Pass</span></span>
        </Link>
        <div className="login-header-actions">
          <span className="login-header-label">{t('loginHeaderLabel')}</span>
          <LanguageSwitcher onDark />
        </div>
      </header>

      <main className="login-main">
        <section className="login-intro">
          <span className="login-kicker">{t('loginKicker')}</span>
          <h1>{t('loginHeadlineLine1')}<br /><span>{t('loginHeadlineLine2')}</span></h1>
          <p>{t('loginIntro')}</p>
          <div className="login-feature-list">
            <span><i aria-hidden="true">✓</i> {t('loginFeatureRecords')}</span>
            <span><i aria-hidden="true">✓</i> {t('loginFeatureWeighbridge')}</span>
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 3 5 6v5c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4" />
            </svg>
          </div>
          <p className="login-card-eyebrow">{t('loginEyebrow')}</p>
          <h2 id="login-title">{t('loginTitle')}</h2>
          <p className="login-card-copy">{t('loginCopy')}</p>
          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-username">{t('labelUsername')}</label>
            <input
              id="login-username"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('placeholderUsername')}
              autoComplete="username"
              required
            />
            <label htmlFor="login-password">{t('labelPassword')}</label>
            <input
              id="login-password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('placeholderPassword')}
              autoComplete="current-password"
              required
            />
            <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
              {submitting ? t('signingIn') : t('signInSecurely')}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <div className="login-secure-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Zm6 4v3" />
            </svg>
            {t('loginSecureNote')}
          </div>
        </section>
      </main>
      <footer className="login-footer">
        <span lang="en" className="login-footer-brand">GatePass</span>
        <span className="login-footer-separator" aria-hidden="true">•</span>
        {t('loginFooterTagline')}
      </footer>
    </div>
  )
}
