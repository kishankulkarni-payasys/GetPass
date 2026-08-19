import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
      <div className="flex flex-wrap gap-4">
        <Link to="/entries" className="font-medium text-gray-700 hover:text-blue-600">
          Entries
        </Link>
        {user.role === 'admin' && (
          <Link to="/users" className="font-medium text-gray-700 hover:text-blue-600">
            Users
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>{user.full_name} ({user.role})</span>
        <button onClick={logout} className="rounded bg-gray-200 px-3 py-1 font-medium text-gray-800">
          Logout
        </button>
      </div>
    </nav>
  )
}
