// Time on site / time in a state, shown as "HH:MM" in the mono font so rows
// line up (as on the control-tower mockup). Latin digits in every language.
const MINUTES_PER_HOUR = 60
const EMPTY_VALUE = '—'

export function formatDwell(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return EMPTY_VALUE
  const total = Math.max(0, Math.round(Number(minutes)))
  const hours = Math.floor(total / MINUTES_PER_HOUR)
  const rest = total % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
