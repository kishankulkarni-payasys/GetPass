import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

// Entry Log filters live above the routes so they survive going to Account or
// Users and back (EntriesPage unmounts there). Kept in memory only: a full
// page reload starts with empty filters, as the spec asks.
// passType / passState / erpStatus hold the API values ('' = any).
export const EMPTY_LOG_FILTERS = {
  vehicleSearch: '',
  dateFrom: '',
  dateTo: '',
  passType: '',
  passState: '',
  erpStatus: '',
}

// Query params for GET /api/entries from the pass filters (blank values are
// dropped by the API client).
export function passFilterParams({ passType, passState, erpStatus }) {
  return { pass_type: passType, state: passState, erp_status: erpStatus }
}

export function hasPassFilters({ passType, passState, erpStatus }) {
  return Boolean(passType || passState || erpStatus)
}

// Applies the pass filters on the client too, so the Log is right whether or
// not the request already carried them. A row without `erp_status` is kept:
// the list API may not send that field, and the server filter then decides.
export function matchesPassFilters(entry, { passType, passState, erpStatus }) {
  if (passType && entry.pass_type !== passType) return false
  if (passState && entry.pass_state !== passState) return false
  if (erpStatus && 'erp_status' in entry && entry.erp_status !== erpStatus) return false
  return true
}

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
