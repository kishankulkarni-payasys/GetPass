export function formatPlate(number: string): string {
  const normalized = number.trim().toUpperCase();
  return normalized.replace(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{1,4})$/, '$1 $2 $3 $4');
}
