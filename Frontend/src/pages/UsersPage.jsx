import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createUser, deleteUser, getUsers, updateUser } from '../api/users'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

const initialForm = { username: '', password: '', full_name: '', role: 'security_guard' }

// How long the "Confirm delete" state stays armed before the button reverts to "Delete".
const DELETE_CONFIRM_TIMEOUT_MS = 4000

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimerRef = useRef(null)

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

  // Clear a pending confirm timer so it cannot set state after the page unmounts.
  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])

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
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || 'Failed to create user', 'error')
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
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || 'Failed to update user', 'error')
    }
  }

  const handleRoleChange = async (targetUser, role) => {
    try {
      await updateUser(targetUser.id, { role })
      await refresh()
      showToast('User role updated', 'success')
    } catch (err) {
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || 'Failed to update user', 'error')
    }
  }

  const resetDeleteConfirm = () => {
    clearTimeout(confirmTimerRef.current)
    setConfirmDeleteId(null)
  }

  // First click arms the button; only a second click within the timeout actually deletes.
  const handleDeleteClick = (targetUser) => {
    if (confirmDeleteId === targetUser.id) {
      resetDeleteConfirm()
      handleDelete(targetUser)
      return
    }
    clearTimeout(confirmTimerRef.current)
    setConfirmDeleteId(targetUser.id)
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), DELETE_CONFIRM_TIMEOUT_MS)
  }

  const handleDelete = async (targetUser) => {
    try {
      await deleteUser(targetUser.id)
      await refresh()
      showToast('User deleted', 'success')
    } catch (err) {
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || 'Failed to delete user', 'error')
    }
  }

  return (
    <div className="page-screen page-users">
      <div className="page-heading mb-5">
        <div>
          <p className="page-kicker">ADMINISTRATION</p>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">User Management</h1>
          <p className="page-description">Manage access, roles, and active accounts for your team.</p>
        </div>
      </div>

      <Card className="user-create-card mb-6">
        <div className="user-create-heading">
          <div className="user-create-icon" aria-hidden="true">+</div>
          <div>
            <h2 className="mb-1 text-base font-bold text-slate-900">Create a team account</h2>
            <p className="mb-0 text-sm text-slate-500">Set up sign-in details and permissions for a new user.</p>
          </div>
        </div>
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

      {loading && <p className="text-slate-500" role="status">Loading users...</p>}
      {error && <p className="text-red-600" role="alert">{error}</p>}
      {!loading && !error && (
        <>
          <div className="user-account-cards">
            {users.map((u) => (
              <article className="user-account-card" key={u.id}>
                <div className="user-account-card-heading">
                  <div className="user-account-avatar" aria-hidden="true">
                    {u.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                  </div>
                  <div className="user-account-identity">
                    <h2>{u.full_name}</h2>
                    <span>@{u.username}</span>
                  </div>
                  <Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <label className="user-role-label" htmlFor={`role-${u.id}`}>Account role</label>
                <Select
                  className="w-full"
                  value={u.role}
                  disabled={u.id === currentUser.id}
                  onChange={(e) => handleRoleChange(u, e.target.value)}
                  id={`role-${u.id}`}
                >
                  <option value="security_guard">Security Guard</option>
                  <option value="weighbridge_operator">Weighbridge Operator</option>
                  <option value="admin">Admin</option>
                </Select>
                <div className="user-account-actions">
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={() => handleToggleActive(u)}
                    disabled={u.id === currentUser.id}
                    className="flex-1"
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteClick(u)}
                    disabled={u.id === currentUser.id}
                    className="flex-1"
                  >
                    {confirmDeleteId === u.id ? 'Confirm delete' : 'Delete'}
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <Card className="user-account-table overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-slate-900">{u.username}</td>
                    <td className="text-slate-600">{u.full_name}</td>
                    <td>
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
                    <td><Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="space-x-2">
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
                        onClick={() => handleDeleteClick(u)}
                        disabled={u.id === currentUser.id}
                      >
                        {confirmDeleteId === u.id ? 'Confirm delete' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
