import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { ROLES, ROUTES, defaultRouteForRole } from '../navigation/navItems'

function AuthLoading() {
  const { t } = useLanguage()
  return <p className="p-6 text-gray-500">{t('loading')}</p>
}

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to={ROUTES.login} replace />
  if (adminOnly && user.role !== ROLES.admin) return <Navigate to={defaultRouteForRole(user.role)} replace />

  return children
}

// `/entries` (and unknown paths) land on the tab each role starts on.
export function RoleHomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to={ROUTES.login} replace />
  return <Navigate to={defaultRouteForRole(user.role)} replace />
}
