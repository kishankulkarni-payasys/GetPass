import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiErrorMessage } from '../i18n/apiErrors'

// Shared by the desktop sidebar and the mobile Account page so both sign out
// with the same toasts. Clearing `user` sends ProtectedRoute to /login.
export function useSignOut() {
  const { logout } = useAuth()
  const { t } = useLanguage()
  const { showToast } = useToast()

  return async () => {
    // Read before logout: the sidebar or Account page that owns this hook
    // unmounts once `user` is cleared. The language itself stays the same
    // after sign-out, so the toast and the login page match.
    const successMessage = t('toastLoggedOut')
    try {
      await logout()
      showToast(successMessage, 'success')
    } catch (err) {
      showToast(apiErrorMessage(err, t, 'toastLogoutFailed'), 'error')
    }
  }
}
