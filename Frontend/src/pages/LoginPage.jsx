import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
export default function LoginPage() {
  const { user, login } = useAuth()
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
      showToast(`Welcome back, ${loggedInUser.full_name}`, 'success')
      navigate('/entries')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Login failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <header className="login-header">
        <Link className="app-brand app-brand-light" to="/login" aria-label="GatePass sign in">
          <span className="app-brand-mark" aria-hidden="true">G</span>
          <span>Gate<span>Pass</span></span>
        </Link>
        <span className="login-header-label">SECURE ACCESS PORTAL</span>
      </header>

      <main className="login-main">
        <section className="login-intro">
          <span className="login-kicker">GATE OPERATIONS, SIMPLIFIED</span>
          <h1>Every arrival.<br /><span>Accounted for.</span></h1>
          <p>One secure workspace for vehicle entry, site operations, and weighbridge teams.</p>
          <div className="login-feature-list">
            <span><i aria-hidden="true">✓</i> Clear vehicle entry records</span>
            <span><i aria-hidden="true">✓</i> Connected weighbridge workflow</span>
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 3 5 6v5c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4" />
            </svg>
          </div>
          <p className="login-card-eyebrow">WELCOME BACK</p>
          <h2 id="login-title">Sign in to GatePass</h2>
          <p className="login-card-copy">Enter your work credentials to continue.</p>
          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              autoComplete="username"
              required
            />
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
            <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in securely'}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <div className="login-secure-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Zm6 4v3" />
            </svg>
            Secure access for authorized team members
          </div>
        </section>
      </main>
      <footer className="login-footer">GATEPASS <span>•</span> SITE OPERATIONS PLATFORM</footer>
    </div>
  )
}
