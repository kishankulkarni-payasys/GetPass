import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Badge from './ui/Badge'
import Button from './ui/Button'

export default function NavBar() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()

  if (!user) return null

  const handleLogout = async () => {
    try {
      await logout()
      showToast('Logged out successfully', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Logout failed', 'error')
    }
  }

  return (
    <header className="bg-slate-900 shadow-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-lg font-bold tracking-tight text-white">GatePass</span>
          <nav className="flex gap-4">
            <Link to="/entries" className="text-sm font-medium text-slate-300 hover:text-white">
              Entries
            </Link>
            {user.role === 'admin' && (
              <Link to="/users" className="text-sm font-medium text-slate-300 hover:text-white">
                Users
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-slate-300">
            {user.full_name}
            <Badge tone="blue">{user.role}</Badge>
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
