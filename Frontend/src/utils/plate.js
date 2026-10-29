// Indian registration plates: state (2 letters), district (1-2 digits),
// series (0-3 letters), number (1-4 digits), e.g. "MH12AB1234".
const STANDARD_PLATE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/

// Stored form: uppercase with spaces and dashes removed ("mh-12 ab 1234" -> "MH12AB1234").
export function normalizePlate(value) {
  return String(value ?? '').toUpperCase().replace(/[\s-]+/g, '')
}

// Display form with spaces between the parts ("MH12AB1234" -> "MH 12 AB 1234").
// Plates that do not follow the standard pattern (BH series, temporary
// numbers) are shown as stored rather than split in the wrong place.
export function formatPlate(value) {
  const plate = normalizePlate(value)
  const match = plate.match(STANDARD_PLATE)
  if (!match) return plate
  return match.slice(1).filter(Boolean).join(' ')
}
