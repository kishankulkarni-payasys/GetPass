import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import EntriesPage from './pages/EntriesPage'
import UsersPage from './pages/UsersPage'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LanguageProvider>
            <div className="min-h-screen bg-slate-50 lg:flex">
              <Sidebar />
              <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-5xl">
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
              </main>
            </div>
          </LanguageProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
