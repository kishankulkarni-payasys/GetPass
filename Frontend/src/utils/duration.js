const MINUTES_PER_HOUR = 60

// Dwell / time-in-state as "hh:mm" (Latin digits, mono in the UI).
export function formatDuration(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined) return '—'
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const rest = minutes % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
