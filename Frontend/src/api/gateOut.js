import apiClient from './client'

// Calls used by the Gate-out section and the printable return out-pass.

export async function getPassDetail(entryId) {
  const response = await apiClient.get(`/entries/${entryId}`)
  return response.data
}

// GRN with its lines; the rejected quantity per line is what leaves on the
// return out-pass (stores may have edited it after the quality result).
export async function getPassGrn(entryId) {
  const response = await apiClient.get(`/entries/${entryId}/grn`)
  return response.data
}

// The server refuses (422) an inward pass with rejected material unless the
// guard confirms that material is on the vehicle.
export async function letPassOut(entryId, rejectedMaterialOnVehicle = false) {
  const response = await apiClient.patch(`/entries/${entryId}/exit`, {
    rejected_material_on_vehicle: rejectedMaterialOnVehicle,
  })
  return response.data
}

export async function cancelPass(entryId, reason) {
  const response = await apiClient.post(`/entries/${entryId}/cancel`, { reason })
  return response.data
}
