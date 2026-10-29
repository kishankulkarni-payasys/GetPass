import apiClient from './client'

// Live indicator value for display only: { available, weight_kg, stable, frame_ref, read_at }.
// `available: false` means no indicator is configured (manual entry only).
export async function getIndicatorReading() {
  const response = await apiClient.get('/weighbridge/reading')
  return response.data
}

// Body: { kind: gross | tare, source: indicator | manual, weight?, unit?, manual_reason?, supersede_reason? }.
// For `indicator` the server reads the indicator itself and stores what it read.
export async function captureWeighment(entryId, body) {
  const response = await apiClient.post(`/entries/${entryId}/weighments`, body)
  return response.data
}
