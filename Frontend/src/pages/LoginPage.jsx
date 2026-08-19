import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

export default function LoginPage() {
  const { user, login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/entries" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const loggedInUser = await login(username, password)
      showToast(`Welcome back, ${loggedInUser.full_name}`, 'success')
      navigate('/entries')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Login failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">GatePass</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Logging in...' : 'Log In'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
