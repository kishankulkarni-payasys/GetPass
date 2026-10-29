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
import DashboardPage from './pages/DashboardPage'
import PassDetailPage from './pages/PassDetailPage'
import ReturnPassPage from './pages/ReturnPassPage'
import UsersPage from './pages/UsersPage'
import AccountPage from './pages/AccountPage'
import { ENTRY_SECTIONS, PAGE_SECTIONS, ROUTES, canOpenSection } from './navigation/navItems'
import { useGateInQueueSync } from './hooks/useGateInQueue'

// Top-level pages and the section (navItems.js) that decides who may open each.
const PAGE_ROUTES = [
  { path: ROUTES.dashboard, section: PAGE_SECTIONS.dashboard, Page: DashboardPage },
  { path: ROUTES.passDetail, section: PAGE_SECTIONS.passDetail, Page: PassDetailPage },
  { path: ROUTES.returnPass, section: PAGE_SECTIONS.returnPass, Page: ReturnPassPage },
  { path: ROUTES.users, section: PAGE_SECTIONS.users, Page: UsersPage },
  { path: ROUTES.account, section: PAGE_SECTIONS.account, Page: AccountPage },
]

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.entries} element={<RoleHomeRedirect />} />
      {/* One route for every gate section; EntriesPage checks the role per section. */}
      <Route
        path={`${ROUTES.entries}/:section`}
        element={
          <ProtectedRoute>
            <EntriesPage />
          </ProtectedRoute>
        }
      />
      {PAGE_ROUTES.map(({ path, section, Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute section={section}>
              <Page />
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<Navigate to={ROUTES.entries} replace />} />
    </Routes>
  )
}

// Sends gate-in passes queued offline on app start and when the network
// returns, for the roles that create passes, whichever screen is open.
function GateInQueueSync() {
  const { user } = useAuth()
  useGateInQueueSync(Boolean(user) && canOpenSection(user.role, ENTRY_SECTIONS.new))
  return null
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
      <GateInQueueSync />
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
