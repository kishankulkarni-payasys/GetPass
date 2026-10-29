import apiClient from './client'

export const GRN_WORK_GROUPS = {
  sendForInspection: 'send_for_inspection',
  readyForGrn: 'ready_for_grn',
  draft: 'draft',
  pendingPost: 'pending_post',
  approved: 'approved',
}

export const GRN_LINE_FLAGS = {
  receivedVsChallan: 'received_differs_from_challan',
  splitVsReceived: 'accepted_rejected_differ_from_received',
  receivedVsPo: 'received_differs_from_po',
  acceptedVsQuality: 'accepted_differs_from_quality',
}

// Store work list. Without filters: send_for_inspection, ready_for_grn,
// draft and pending_post items; `approved` items only when filtered.
export async function getStoreWorkList(filters = {}) {
  const response = await apiClient.get('/grn', { params: filters })
  return response.data
}

// T3: ON_SITE -> QUALITY_PENDING.
export async function sendToQuality(entryId) {
  const response = await apiClient.post(`/entries/${entryId}/send-to-quality`)
  return response.data
}

// T5: creates the draft pre-filled from the challan, quality result and PO snapshot.
export async function startGrn(entryId) {
  const response = await apiClient.post(`/entries/${entryId}/grn`)
  return response.data
}

export async function getGrn(entryId) {
  const response = await apiClient.get(`/entries/${entryId}/grn`)
  return response.data
}

// lines: [{ id, received_qty?, accepted_qty?, rejected_qty?, remarks? }]; GRN_DRAFT only.
export async function editGrnLines(entryId, lines) {
  const response = await apiClient.patch(`/entries/${entryId}/grn/lines`, { lines })
  return response.data
}

// 200 whatever the ERP outcome; read `erp_status` / `erp_last_error` from the response.
export async function approveGrn(entryId) {
  const response = await apiClient.post(`/entries/${entryId}/grn/approve`)
  return response.data
}

export async function retryGrnPost(entryId) {
  const response = await apiClient.post(`/entries/${entryId}/grn/retry-post`)
  return response.data
}
