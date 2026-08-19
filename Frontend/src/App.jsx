import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import EntriesPage from './pages/EntriesPage'
import UsersPage from './pages/UsersPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <NavBar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/entries"
              element={
                <ProtectedRoute>
                  <EntriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute adminOnly>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/entries" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
