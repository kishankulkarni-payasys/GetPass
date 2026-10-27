import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES, initialsOf } from '../navigation/navItems'

const DEFAULT_PAGE = { section: 'Operations', page: 'Vehicle entries' }

// Matched by path prefix so every /entries/<section> keeps the same header.
const PAGE_DETAILS = [
  { prefix: ROUTES.entries, ...DEFAULT_PAGE },
  { prefix: ROUTES.users, section: 'Administration', page: 'User management' },
  { prefix: ROUTES.account, section: 'Profile', page: 'Account' },
]

function pageDetailsFor(pathname) {
  return PAGE_DETAILS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ?? DEFAULT_PAGE
}

// Desktop (lg and up) only; MobileTopBar replaces it below lg.
export default function AppHeader() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!user) return null

  const { section, page } = pageDetailsFor(pathname)

  return (
    <header className="app-header">
      <div className="app-header-context">
        <span className="app-header-eyebrow">{section}</span>
        <span className="app-header-divider" aria-hidden="true">/</span>
        <span className="app-header-page">{page}</span>
      </div>
      <div className="app-header-account">
        <span className="app-header-status"><span aria-hidden="true" /> Operations active</span>
        <div className="app-header-avatar" aria-hidden="true">{initialsOf(user.full_name)}</div>
        <div className="app-header-user">
          <span className="app-header-name">{user.full_name}</span>
          <span className="app-header-role">{user.role.replaceAll('_', ' ')}</span>
        </div>
      </div>
    </header>
  )
}
