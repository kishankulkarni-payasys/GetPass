import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import AppHeader from './components/AppHeader'
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
            <div className="app-shell min-h-screen lg:flex">
              <Sidebar />
              <main className="app-main min-w-0 flex-1">
                <AppHeader />
                <div className="app-content mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
