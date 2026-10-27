import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient, { setUnauthorizedHandler } from '../api/client'
import { translations } from '../i18n/translations'
import { useToast } from './ToastContext'

const AuthContext = createContext(null)

// Same key LanguageContext persists to. AuthProvider sits above LanguageProvider,
// so it reads the stored choice directly instead of using useLanguage().
const LANGUAGE_STORAGE_KEY = 'getpass:language'
const DEFAULT_LANGUAGE = 'en'
const SESSION_EXPIRED_KEY = 'toastSessionExpired'
const HTTP_UNAUTHORIZED = 401

// Mirrors LanguageContext: only security_guard sees hi/mr.
function sessionExpiredMessage(role) {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  const language = role === 'security_guard' && translations[stored] ? stored : DEFAULT_LANGUAGE
  return translations[language][SESSION_EXPIRED_KEY] ?? translations[DEFAULT_LANGUAGE][SESSION_EXPIRED_KEY]
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const userRef = useRef(null)
  // Several requests usually fail together once the cookie expires; only the
  // first one should log out and toast. Reset on the next successful login.
  const sessionExpiredRef = useRef(false)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    return setUnauthorizedHandler(() => {
      if (sessionExpiredRef.current) return
      sessionExpiredRef.current = true
      showToast(sessionExpiredMessage(userRef.current?.role), 'error')
      setUser(null)
      navigate('/login', { replace: true })
    })
  }, [navigate, showToast])

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password })
    sessionExpiredRef.current = false
    setUser(response.data)
    return response.data
  }

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch (err) {
      // An expired cookie means the server already considers us logged out.
      if (err.response?.status !== HTTP_UNAUTHORIZED) throw err
    } finally {
      // Clear the local session even when the server call fails, so the user is never stuck "logged in".
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
