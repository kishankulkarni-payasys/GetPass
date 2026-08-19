import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createUser, deleteUser, getUsers, updateUser } from '../api/users'

const initialForm = { username: '', password: '', full_name: '', role: 'security_guard' }

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await createUser(form)
      setForm(initialForm)
      await refresh()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (targetUser) => {
    await updateUser(targetUser.id, { is_active: !targetUser.is_active })
    await refresh()
  }

  const handleRoleChange = async (targetUser, role) => {
    await updateUser(targetUser.id, { role })
    await refresh()
  }

  const handleDelete = async (targetUser) => {
    await deleteUser(targetUser.id)
    await refresh()
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">User Management</h1>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input name="username" value={form.username} onChange={handleChange} placeholder="Username" required className="rounded border border-gray-300 px-3 py-2" />
        <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" required className="rounded border border-gray-300 px-3 py-2" />
        <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Full Name" required className="rounded border border-gray-300 px-3 py-2" />
        <select name="role" value={form.role} onChange={handleChange} className="rounded border border-gray-300 px-3 py-2">
          <option value="security_guard">Security Guard</option>
          <option value="admin">Admin</option>
        </select>
        {formError && <p className="col-span-full text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="col-span-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50 sm:col-span-1"
        >
          {submitting ? 'Saving...' : 'Create User'}
        </button>
      </form>

      {loading && <p className="text-gray-500">Loading users...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Username</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Full Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Role</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.username}</td>
                  <td className="px-3 py-2">{u.full_name}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="security_guard">Security Guard</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">{u.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={u.id === currentUser.id}
                      className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={u.id === currentUser.id}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
