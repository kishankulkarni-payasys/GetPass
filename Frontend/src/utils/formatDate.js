// Short local date-time for cards: "27 Oct, 10:42 am". The year is only
// added when it differs from the current one, to keep cards compact.
const CARD_DATE_LOCALE = 'en-IN'

export function formatCardDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const showYear = date.getFullYear() !== new Date().getFullYear()
  const day = date.toLocaleDateString(CARD_DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
  })
  const time = date
    .toLocaleTimeString(CARD_DATE_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase()
  return `${day}, ${time}`
}
