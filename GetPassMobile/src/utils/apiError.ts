/** Mirrors the inline helper in LoginScreen: axios error -> the backend's readable `detail` string. */
export function extractErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.length > 0) return detail;
  return fallback;
}
