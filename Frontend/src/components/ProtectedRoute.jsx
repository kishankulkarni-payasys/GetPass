import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { ROUTES, canOpenSection, defaultRouteForRole } from '../navigation/navItems'

function AuthLoading() {
  const { t } = useLanguage()
  return <p className="p-6 text-gray-500">{t('loading')}</p>
}

// `section` (a PAGE_SECTIONS / ENTRY_SECTIONS value) limits the route to the
// roles in navItems.js; without it any signed-in user may open the route.
// A role that may not open the section is sent to its own home page.
export default function ProtectedRoute({ children, section }) {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to={ROUTES.login} replace />
  if (section && !canOpenSection(user.role, section)) return <Navigate to={defaultRouteForRole(user.role)} replace />

  return children
}

// `/entries` (and unknown paths) land on the tab each role starts on.
export function RoleHomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to={ROUTES.login} replace />
  return <Navigate to={defaultRouteForRole(user.role)} replace />
}
