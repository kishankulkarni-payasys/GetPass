import apiClient from './client'

export async function getEntries(filters = {}) {
  const response = await apiClient.get('/entries', { params: filters })
  return response.data
}

export async function createEntry(entry) {
  const response = await apiClient.post('/entries', entry)
  return response.data
}

export async function exitEntry(id) {
  const response = await apiClient.patch(`/entries/${id}/exit`)
  return response.data
}
