import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { requestPasswordReset, resetPassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiErrorDetail } from '../i18n/apiErrors'
import { ROUTES } from '../navigation/navItems'

// Two steps in one screen: request a code, then enter it with a new
// password. The backend always answers the request step with a generic
// message (it never reveals whether the account exists), so this page moves
// to the reset step unconditionally once that call succeeds.
const STEPS = { REQUEST: 'request', RESET: 'reset' }

function RequestStep({ onRequested }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [identifier, setIdentifier] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await requestPasswordReset(identifier)
      onRequested()
    } catch (err) {
      showToast(apiErrorDetail(err) ?? t('forgotPasswordRequestFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <label htmlFor="forgot-identifier">{t('forgotPasswordIdentifierLabel')}</label>
      <input
        id="forgot-identifier"
        className="form-control"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder={t('forgotPasswordIdentifierPlaceholder')}
        autoComplete="username"
        required
      />
      <button type="submit" className="btn btn-primary login-submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? t('forgotPasswordSubmitting') : t('forgotPasswordSubmit')}
        {!submitting && <span aria-hidden="true">→</span>}
      </button>
    </form>
  )
}

const MIN_PASSWORD_LENGTH = 8

function ResetStep() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (password !== confirmPassword) {
      setFormError(t('resetPasswordMismatch'))
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token.trim(), password)
      showToast(t('resetPasswordSuccess'), 'success')
      navigate(ROUTES.login, { replace: true })
    } catch (err) {
      setFormError(apiErrorDetail(err) ?? t('resetPasswordFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <label htmlFor="reset-token">{t('resetPasswordCodeLabel')}</label>
      <input
        id="reset-token"
        className="form-control"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder={t('resetPasswordCodePlaceholder')}
        autoComplete="one-time-code"
        required
      />
      <label htmlFor="reset-new-password">{t('resetPasswordNewLabel')}</label>
      <input
        id="reset-new-password"
        className="form-control"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('resetPasswordNewPlaceholder')}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      <label htmlFor="reset-confirm-password">{t('resetPasswordConfirmLabel')}</label>
      <input
        id="reset-confirm-password"
        className="form-control"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder={t('resetPasswordConfirmPlaceholder')}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      {formError && (
        <p className="login-form-error" role="alert">
          {formError}
        </p>
      )}
      <button type="submit" className="btn btn-primary login-submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? t('resetPasswordSubmitting') : t('resetPasswordSubmit')}
        {!submitting && <span aria-hidden="true">→</span>}
      </button>
    </form>
  )
}

export default function ForgotPasswordPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [step, setStep] = useState(STEPS.REQUEST)

  if (user) return <Navigate to={ROUTES.entries} replace />

  const isResetStep = step === STEPS.RESET

  return (
    <div className="login-screen">
      <header className="login-header">
        <Link className="app-brand app-brand-light" to={ROUTES.login} aria-label={t('loginHomeAria')}>
          <span className="app-brand-mark" aria-hidden="true">G</span>
          <span lang="en">Gate<span>Pass</span></span>
        </Link>
        <div className="login-header-actions">
          <span className="login-header-label">{t('loginHeaderLabel')}</span>
          <LanguageSwitcher onDark />
        </div>
      </header>

      <main className="login-main login-main-single">
        <section className="login-card" aria-labelledby="forgot-password-title">
          <div className="login-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm1-10V7a5 5 0 0 1 10 0v2" />
            </svg>
          </div>
          <p className="login-card-eyebrow">{isResetStep ? t('resetPasswordEyebrow') : t('forgotPasswordEyebrow')}</p>
          <h2 id="forgot-password-title">{isResetStep ? t('resetPasswordTitle') : t('forgotPasswordTitle')}</h2>
          <p className="login-card-copy">{isResetStep ? t('resetPasswordCopy') : t('forgotPasswordCopy')}</p>

          {isResetStep && (
            <p className="login-form-notice" role="status">
              {t('forgotPasswordRequestSent')}
            </p>
          )}

          {isResetStep ? <ResetStep /> : <RequestStep onRequested={() => setStep(STEPS.RESET)} />}

          <Link className="login-forgot-link" to={ROUTES.login}>
            {t('forgotPasswordBackToLogin')}
          </Link>
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
