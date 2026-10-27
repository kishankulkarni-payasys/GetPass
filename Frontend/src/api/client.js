import axios from 'axios'

const HTTP_UNAUTHORIZED = 401

// A 401 from these endpoints is an expected answer (not logged in yet, wrong
// password, cookie already gone on logout), not a session that just expired.
const AUTH_ENDPOINTS_WITHOUT_EXPIRY = new Set(['/auth/me', '/auth/login', '/auth/logout'])

// FastAPI prefixes each validation error location with where the value came
// from; that part means nothing to a guard reading the message.
const REQUEST_LOCATION_PREFIXES = new Set(['body', 'query', 'path', 'header', 'cookie'])
const PYDANTIC_VALUE_ERROR_PREFIX = 'Value error, '

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

let unauthorizedHandler = null

// Lets AuthContext react to an expired session without client.js importing React.
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null
  }
}

function formatValidationError({ loc = [], msg = '' }) {
  const field = loc.filter((part, index) => !(index === 0 && REQUEST_LOCATION_PREFIXES.has(part))).join('.')
  const message = msg.startsWith(PYDANTIC_VALUE_ERROR_PREFIX) ? msg.slice(PYDANTIC_VALUE_ERROR_PREFIX.length) : msg
  return field ? `${field}: ${message}` : message
}

// Screens render `detail` directly, so FastAPI's 422 error list must become
// plain text before it reaches them.
function normalizeErrorDetail(response) {
  const detail = response?.data?.detail
  if (!Array.isArray(detail)) return
  response.data.detail = detail.map(formatValidationError).filter(Boolean).join('; ')
}

function isSessionExpiry(error) {
  if (error.response?.status !== HTTP_UNAUTHORIZED) return false
  return !AUTH_ENDPOINTS_WITHOUT_EXPIRY.has(error.config?.url)
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    normalizeErrorDetail(error.response)
    if (isSessionExpiry(error)) {
      // Screens check this flag so they don't add their own error toast on top
      // of the single "session expired" one.
      error.isSessionExpired = true
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  },
)

export default apiClient
