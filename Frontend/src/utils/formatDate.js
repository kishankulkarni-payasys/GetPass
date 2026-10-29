// All date display goes through here so cards and desktop tables match and
// follow the chosen language. Pass `locale` from useLanguage().
//
// Digits are always Western (0-9): `mr-IN` would otherwise print Devanagari
// digits, and staff compare these against challans and the weighbridge display.
const DEFAULT_LOCALE = 'en-IN'
const LATIN_DIGITS_EXTENSION = '-u-nu-latn'

const DAY_MONTH = { day: 'numeric', month: 'short' }
const TIME = { hour: 'numeric', minute: '2-digit', hour12: true }

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(date, locale, dateOptions) {
  const localeWithLatinDigits = `${locale}${LATIN_DIGITS_EXTENSION}`
  const day = date.toLocaleDateString(localeWithLatinDigits, dateOptions)
  // "am"/"pm" read better in lower case in English; it is a no-op for Devanagari.
  const time = date.toLocaleTimeString(localeWithLatinDigits, TIME).toLowerCase()
  return `${day}, ${time}`
}

// Compact, for cards: "27 Oct, 10:42 am". The year is added only when it
// differs from the current one.
export function formatCardDateTime(value, locale = DEFAULT_LOCALE) {
  const date = parseDate(value)
  if (!date) return ''
  const showYear = date.getFullYear() !== new Date().getFullYear()
  return formatDateTime(date, locale, showYear ? { ...DAY_MONTH, year: 'numeric' } : DAY_MONTH)
}

// Always with the year, for desktop tables: "27 Oct 2026, 10:42 am".
export function formatFullDateTime(value, locale = DEFAULT_LOCALE) {
  const date = parseDate(value)
  if (!date) return ''
  return formatDateTime(date, locale, { ...DAY_MONTH, year: 'numeric' })
}
