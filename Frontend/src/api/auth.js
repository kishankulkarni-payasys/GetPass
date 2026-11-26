import apiClient from './client'

// Always resolves with a generic confirmation message - the backend never
// reveals whether the account exists, so the UI doesn't need to branch on it.
export async function requestPasswordReset(identifier) {
  const response = await apiClient.post('/auth/forgot-password', { identifier })
  return response.data
}

// Rejects with a 400 when the token is invalid or expired; the caller shows
// that as a form error rather than a toast so the user can retry in place.
export async function resetPassword(token, password) {
  const response = await apiClient.post('/auth/reset-password', { token, password })
  return response.data
}
