import apiClient from './client'

// Passes waiting for inspection (QUALITY_PENDING) and passes whose result can
// still be corrected (QUALITY_RESOLVED), oldest first, with challan lines.
export async function getQualityQueue() {
  const response = await apiClient.get('/quality/queue')
  return response.data
}

// `result` is derived by the server from the lines (approved / partial / rejected).
// body: { lines: [{ challan_line_id, accepted_qty, rejected_qty, remarks? }], remarks? }
export async function saveQualityResult(entryId, body) {
  const response = await apiClient.put(`/entries/${entryId}/quality-result`, body)
  return response.data
}
