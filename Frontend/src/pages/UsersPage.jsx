import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createUser, deleteUser, getUsers, updateUser } from '../api/users'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

const initialForm = { username: '', password: '', full_name: '', role: 'security_guard' }

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(initialForm)
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
    try {
      await createUser(form)
      setForm(initialForm)
      await refresh()
      showToast('User created', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create user', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (targetUser) => {
    try {
      await updateUser(targetUser.id, { is_active: !targetUser.is_active })
      await refresh()
      showToast(targetUser.is_active ? 'User deactivated' : 'User activated', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update user', 'error')
    }
  }

  const handleRoleChange = async (targetUser, role) => {
    try {
      await updateUser(targetUser.id, { role })
      await refresh()
      showToast('User role updated', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update user', 'error')
    }
  }

  const handleDelete = async (targetUser) => {
    try {
      await deleteUser(targetUser.id)
      await refresh()
      showToast('User deleted', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete user', 'error')
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">User Management</h1>

      <Card className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Create User</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="username" value={form.username} onChange={handleChange} placeholder="Username" required />
          <Input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" required />
          <Input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Full Name" required />
          <Select name="role" value={form.role} onChange={handleChange}>
            <option value="security_guard">Security Guard</option>
            <option value="weighbridge_operator">Weighbridge Operator</option>
            <option value="admin">Admin</option>
          </Select>
          <Button type="submit" disabled={submitting} className="col-span-full sm:col-span-1">
            {submitting ? 'Saving...' : 'Create User'}
          </Button>
        </form>
      </Card>

      {loading && <p className="text-slate-500">Loading users...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Username</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.username}</td>
                  <td className="px-4 py-3 text-slate-600">{u.full_name}</td>
                  <td className="px-4 py-3">
                    <Select
                      size="sm"
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                    >
                      <option value="security_guard">Security Guard</option>
                      <option value="weighbridge_operator">Weighbridge Operator</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => handleToggleActive(u)}
                      disabled={u.id === currentUser.id}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(u)}
                      disabled={u.id === currentUser.id}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
