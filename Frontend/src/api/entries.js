import apiClient from './client'

// FastAPI reads repeated list params as `state=A&state=B`; axios would send `state[]=A`.
const REPEATED_PARAMS = { indexes: null }

// Blank filters (e.g. a cleared search box) are left out so an empty string is
// never sent to typed params like date_from, which would fail validation.
function withoutBlankValues(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0
      return value !== undefined && value !== null && value !== ''
    }),
  )
}

// Filters: vehicle_number, date_from, date_to, weighed, pass_type, state (array), erp_status.
export async function getEntries(filters = {}) {
  const response = await apiClient.get('/entries', {
    params: withoutBlankValues(filters),
    paramsSerializer: REPEATED_PARAMS,
  })
  return response.data
}

// Full pass: challan lines, weighments, current gross / tare / net, quality,
// GRN summary, photos with kind and the audit timeline.
export async function getEntry(id) {
  const response = await apiClient.get(`/entries/${id}`)
  return response.data
}

// 201 for a new pass, 200 with the existing pass when `client_ref` was already used.
export async function createEntry(entry) {
  const response = await apiClient.post('/entries', entry)
  return response.data
}

// `rejectedMaterialOnVehicle` is required (true) when the GRN rejected any quantity.
export async function exitEntry(id, { rejectedMaterialOnVehicle = false } = {}) {
  const response = await apiClient.patch(`/entries/${id}/exit`, {
    rejected_material_on_vehicle: rejectedMaterialOnVehicle,
  })
  return response.data
}

export async function cancelEntry(id, reason) {
  const response = await apiClient.post(`/entries/${id}/cancel`, { reason })
  return response.data
}

// Legacy manual gross weight; the weighbridge screen uses captureWeighment instead.
export async function recordWeight(id, payload) {
  const response = await apiClient.patch(`/entries/${id}/weight`, payload)
  return response.data
}

// `kind`: plate, po_doc, challan_doc, weigh_frame, vehicle or other.
// `weighmentId` links weigh-frame photos to the weighment they document.
export async function uploadPhotos(id, files, { kind, weighmentId } = {}) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  if (kind) formData.append('kind', kind)
  if (weighmentId) formData.append('weighment_id', String(weighmentId))
  // apiClient defaults Content-Type to application/json; clearing it here lets
  // the browser set multipart/form-data with the correct boundary itself.
  const response = await apiClient.post(`/entries/${id}/photos`, formData, {
    headers: { 'Content-Type': undefined },
  })
  return response.data
}
