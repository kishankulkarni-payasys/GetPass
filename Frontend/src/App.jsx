import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { EntryLogFiltersProvider } from './context/EntryLogFiltersContext'
import { LanguageProvider } from './context/LanguageContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import AppHeader from './components/AppHeader'
import MobileTopBar from './components/MobileTopBar'
import BottomTabBar from './components/BottomTabBar'
import ProtectedRoute, { RoleHomeRedirect } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import EntriesPage from './pages/EntriesPage'
import UsersPage from './pages/UsersPage'
import AccountPage from './pages/AccountPage'
import { ROUTES } from './navigation/navItems'

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.entries} element={<RoleHomeRedirect />} />
      {/* One route for every section so EntriesPage stays mounted (and keeps
          its Entry Log filters) while the user switches tabs. */}
      <Route
        path={`${ROUTES.entries}/:section`}
        element={
          <ProtectedRoute>
            <EntriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.users}
        element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.account}
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.entries} replace />} />
    </Routes>
  )
}

function AppLayout() {
  const { user } = useAuth()

  return (
    <div className={`app-shell min-h-screen ${user ? 'app-shell-signed-in' : ''}`}>
      <Sidebar />
      <main className="app-main min-w-0 flex-1">
        <AppHeader />
        <MobileTopBar />
        <div className="app-content mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <EntryLogFiltersProvider>
            <AppRoutes />
          </EntryLogFiltersProvider>
        </div>
      </main>
      <BottomTabBar />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LanguageProvider>
            <AppLayout />
          </LanguageProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
