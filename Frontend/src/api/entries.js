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

export async function recordWeight(id, payload) {
  const response = await apiClient.patch(`/entries/${id}/weight`, payload)
  return response.data
}

export async function uploadPhotos(id, files) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  // apiClient defaults Content-Type to application/json; clearing it here lets
  // the browser set multipart/form-data with the correct boundary itself.
  const response = await apiClient.post(`/entries/${id}/photos`, formData, {
    headers: { 'Content-Type': undefined },
  })
  return response.data
}
