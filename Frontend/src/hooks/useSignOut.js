import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'

// Shared by the desktop sidebar and the mobile Account page so both sign out
// with the same toasts. Clearing `user` sends ProtectedRoute to /login.
export function useSignOut() {
  const { logout } = useAuth()
  const { t } = useLanguage()
  const { showToast } = useToast()

  return async () => {
    // Read before logout: once `user` is cleared, t() falls back to English.
    const successMessage = t('toastLoggedOut')
    const failureMessage = t('toastLogoutFailed')
    try {
      await logout()
      showToast(successMessage, 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || failureMessage, 'error')
    }
  }
}
