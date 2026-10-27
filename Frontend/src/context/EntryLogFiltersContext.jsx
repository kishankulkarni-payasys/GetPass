import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

// Entry Log filters live above the routes so they survive going to Account or
// Users and back (EntriesPage unmounts there). Kept in memory only: a full
// page reload starts with empty filters, as the spec asks.
export const EMPTY_LOG_FILTERS = { vehicleSearch: '', dateFrom: '', dateTo: '' }

const EntryLogFiltersContext = createContext(null)

export function EntryLogFiltersProvider({ children }) {
  const { user } = useAuth()
  const [logFilters, setLogFilters] = useState(EMPTY_LOG_FILTERS)

  // Gate devices are shared: the next person to sign in starts with clean filters.
  useEffect(() => {
    setLogFilters(EMPTY_LOG_FILTERS)
  }, [user?.id])

  const updateLogFilter = useCallback((field, value) => setLogFilters((prev) => ({ ...prev, [field]: value })), [])
  const clearLogFilters = useCallback(() => setLogFilters(EMPTY_LOG_FILTERS), [])

  const value = useMemo(
    () => ({ logFilters, updateLogFilter, clearLogFilters }),
    [logFilters, updateLogFilter, clearLogFilters],
  )

  return <EntryLogFiltersContext.Provider value={value}>{children}</EntryLogFiltersContext.Provider>
}

export function useEntryLogFilters() {
  return useContext(EntryLogFiltersContext)
}
