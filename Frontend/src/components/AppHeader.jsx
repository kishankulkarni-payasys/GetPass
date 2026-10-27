import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const pageDetails = {
  '/entries': { section: 'Operations', page: 'Vehicle entries' },
  '/users': { section: 'Administration', page: 'User management' },
}

export default function AppHeader() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!user) return null

  const { section, page } = pageDetails[pathname] || pageDetails['/entries']
  const initials = user.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <header className="app-header">
      <div className="app-header-context">
        <span className="app-header-eyebrow">{section}</span>
        <span className="app-header-divider" aria-hidden="true">/</span>
        <span className="app-header-page">{page}</span>
      </div>
      <div className="app-header-account">
        <span className="app-header-status"><span aria-hidden="true" /> Operations active</span>
        <div className="app-header-avatar" aria-hidden="true">{initials}</div>
        <div className="app-header-user">
          <span className="app-header-name">{user.full_name}</span>
          <span className="app-header-role">{user.role.replaceAll('_', ' ')}</span>
        </div>
      </div>
    </header>
  )
}
