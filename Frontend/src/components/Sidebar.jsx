import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Badge from './ui/Badge'
import Button from './ui/Button'

const navLinkClasses = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)

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
    <>
      <div className="flex items-center justify-between bg-slate-900 px-4 py-4 lg:hidden">
        <span className="text-lg font-bold tracking-tight text-white">GatePass</span>
        <button onClick={() => setIsOpen(true)} className="text-slate-300 hover:text-white" aria-label="Open menu">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {isOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setIsOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-5">
            <span className="text-lg font-bold tracking-tight text-white">GatePass</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            <NavLink to="/entries" onClick={() => setIsOpen(false)} className={navLinkClasses}>
              Entries
            </NavLink>
            {user.role === 'admin' && (
              <NavLink to="/users" onClick={() => setIsOpen(false)} className={navLinkClasses}>
                Users
              </NavLink>
            )}
          </nav>
          <div className="border-t border-slate-800 px-6 py-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
              {user.full_name}
              <Badge tone="blue">{user.role}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full">
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
