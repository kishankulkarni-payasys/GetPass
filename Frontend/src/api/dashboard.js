import apiClient from './client'

// `day` is a site-local date ("YYYY-MM-DD"); left out, the server uses today.
export async function getDashboardSummary(day) {
  const params = day ? { day } : {}
  const response = await apiClient.get('/dashboard/summary', { params })
  return response.data
}
