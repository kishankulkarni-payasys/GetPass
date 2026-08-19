import apiClient from './client'

export async function getUsers() {
  const response = await apiClient.get('/users')
  return response.data
}

export async function createUser(user) {
  const response = await apiClient.post('/users', user)
  return response.data
}

export async function updateUser(id, updates) {
  const response = await apiClient.patch(`/users/${id}`, updates)
  return response.data
}

export async function deleteUser(id) {
  await apiClient.delete(`/users/${id}`)
}
