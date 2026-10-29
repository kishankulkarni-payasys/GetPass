// Supplier / vehicle QR codes are untrusted input: only plain strings and
// numbers are accepted, capped to the field limits, and only known fields.
const QR_FIELD_LIMITS = {
  vehicle_number: 20,
  driver_name: 100,
  driver_phone: 20,
  po_number: 50,
  challan_number: 50,
  supplier_transporter_name: 100,
  reference_doc_number: 50,
  project_name: 100,
  subproject_name: 100,
  material_description: 200,
  material_unit: 20,
  purpose: 50,
}

// Older supplier QR codes use these names.
const QR_FIELD_ALIASES = {
  supplier: 'supplier_transporter_name',
  supplier_name: 'supplier_transporter_name',
  po: 'po_number',
  challan: 'challan_number',
  plate: 'vehicle_number',
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cleanValue(value, field) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  return String(value).trim().slice(0, QR_FIELD_LIMITS[field])
}

// Returns { field: value } for the fields the code carries. A code that is
// not a JSON object is read as a bare plate number.
export function readQrPayload(decodedText) {
  const parsed = parseJson(decodedText)
  if (!isPlainObject(parsed)) {
    const plate = cleanValue(typeof parsed === 'number' || typeof parsed === 'string' ? parsed : decodedText, 'vehicle_number')
    return plate ? { vehicle_number: plate } : {}
  }
  const values = {}
  Object.entries(parsed).forEach(([key, value]) => {
    const field = QR_FIELD_ALIASES[key] ?? key
    if (!(field in QR_FIELD_LIMITS)) return
    const cleaned = cleanValue(value, field)
    if (cleaned) values[field] = cleaned
  })
  return values
}
