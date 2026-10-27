import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createUser, deleteUser, getUsers, updateUser } from '../api/users'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import ListState from '../components/ui/ListState'
import RecordCard, { RecordCardList } from '../components/ui/RecordCard'
import Select from '../components/ui/Select'
import './UsersPage.css'

const initialForm = { username: '', password: '', full_name: '', role: 'security_guard' }

const CREATE_FORM_ID = 'create-user-form'
const MAX_INITIALS = 2

const ROLE_OPTIONS = [
  { value: 'security_guard', label: 'Security Guard' },
  { value: 'weighbridge_operator', label: 'Weighbridge Operator' },
  { value: 'admin', label: 'Admin' },
]

function initialsOf(fullName = '') {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function RoleOptions() {
  return ROLE_OPTIONS.map(({ value, label }) => (
    <option key={value} value={value}>{label}</option>
  ))
}

function StatusBadges({ user, isSelf }) {
  return (
    <span className="users-card-badges">
      {isSelf && <Badge tone="blue">You</Badge>}
      <Badge tone={user.is_active ? 'green' : 'slate'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
    </span>
  )
}

function UserCard({ user, isSelf, isConfirmingDelete, onRoleChange, onToggleActive, onDeleteClick }) {
  const roleSelectId = `card-role-${user.id}`
  return (
    <RecordCard
      title={user.full_name}
      subtitle={`@${user.username}`}
      leading={<span className="users-avatar" aria-hidden="true">{initialsOf(user.full_name)}</span>}
      badge={<StatusBadges user={user} isSelf={isSelf} />}
      actions={
        <>
          <Button variant="warning" size="sm" onClick={() => onToggleActive(user)} disabled={isSelf}>
            {user.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDeleteClick(user)} disabled={isSelf}>
            {isConfirmingDelete ? 'Confirm delete' : 'Delete'}
          </Button>
        </>
      }
    >
      <label className="users-role-label" htmlFor={roleSelectId}>Account role</label>
      <Select
        id={roleSelectId}
        className="users-role-select w-full"
        value={user.role}
        disabled={isSelf}
        onChange={(e) => onRoleChange(user, e.target.value)}
      >
        <RoleOptions />
      </Select>
    </RecordCard>
  )
}

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
  // Mobile only: the create form starts collapsed so the user list is visible first.
  const [createOpen, setCreateOpen] = useState(false)
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
      setCreateOpen(false)
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

      {/* Mobile only: the create form is collapsed behind this button (always shown on desktop). */}
      <div className="users-add-toggle d-lg-none mb-4">
        <Button
          type="button"
          variant={createOpen ? 'secondary' : 'primary'}
          aria-expanded={createOpen}
          aria-controls={CREATE_FORM_ID}
          onClick={() => setCreateOpen((open) => !open)}
        >
          {createOpen ? 'Hide form' : 'Add user'}
        </Button>
      </div>

      <div id={CREATE_FORM_ID} className={createOpen ? '' : 'd-none d-lg-block'}>
        <Card className="user-create-card mb-6">
          <div className="user-create-heading">
            <div className="user-create-icon" aria-hidden="true">+</div>
            <div>
              <h2 className="mb-1 text-base font-bold text-slate-900">Create a team account</h2>
              <p className="mb-0 text-sm text-slate-500">Set up sign-in details and permissions for a new user.</p>
            </div>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input name="username" value={form.username} onChange={handleChange} placeholder="Username" aria-label="Username" required />
            <Input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" aria-label="Password" required />
            <Input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Full Name" aria-label="Full name" required />
            <Select name="role" value={form.role} onChange={handleChange} aria-label="Role">
              <RoleOptions />
            </Select>
            <Button type="submit" disabled={submitting} className="users-create-submit col-span-full sm:col-span-1">
              {submitting ? 'Saving...' : 'Create User'}
            </Button>
          </form>
        </Card>
      </div>

      <ListState
        loading={loading}
        error={error}
        isEmpty={users.length === 0}
        onRetry={refresh}
        emptyMessage="No user accounts yet."
        loadingLabel="Loading users..."
      >
        <RecordCardList refreshing={loading} className="d-lg-none">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isSelf={u.id === currentUser.id}
              isConfirmingDelete={confirmDeleteId === u.id}
              onRoleChange={handleRoleChange}
              onToggleActive={handleToggleActive}
              onDeleteClick={handleDeleteClick}
            />
          ))}
        </RecordCardList>

        <div className={`d-none d-lg-block ${loading ? 'users-table-refreshing' : ''}`} aria-busy={loading || undefined}>
          <Card className="users-table overflow-x-auto p-0">
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
                        aria-label={`Role for ${u.username}`}
                      >
                        <RoleOptions />
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
        </div>
      </ListState>
    </div>
  )
}
