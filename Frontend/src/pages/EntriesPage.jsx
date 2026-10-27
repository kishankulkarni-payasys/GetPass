import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import LanguageSwitcher from '../components/LanguageSwitcher'
import WeighbridgeTab from '../components/WeighbridgeTab'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useEntryLogFilters } from '../context/EntryLogFiltersContext'
import { useLanguage } from '../context/LanguageContext'
import { useEntries } from '../hooks/useEntries'
import {
  ENTRY_SECTIONS,
  ROLES,
  canOpenSection,
  defaultRouteForRole,
  entrySectionTabsForRole,
  tabLabel,
} from '../navigation/navItems'

// Long enough that a guard typing "MH12AB1234" triggers one request, not ten.
const VEHICLE_SEARCH_DEBOUNCE_MS = 400

// Date inputs give a LOCAL calendar day ("2026-10-27"); the API compares UTC
// instants, so send the local day's first and last millisecond as UTC ISO strings.
function localDayStartIso(day) {
  return day ? new Date(`${day}T00:00:00`).toISOString() : ''
}

function localDayEndIso(day) {
  return day ? new Date(`${day}T23:59:59.999`).toISOString() : ''
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

function FilterField({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  )
}

function DateFilterFields({ dateFrom, dateTo, onChange }) {
  const { t } = useLanguage()

  return (
    <>
      <FilterField label={t('labelDateFrom')}>
        <Input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => onChange('dateFrom', e.target.value)}
          className="w-full min-w-0"
        />
      </FilterField>
      <FilterField label={t('labelDateTo')}>
        <Input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => onChange('dateTo', e.target.value)}
          className="w-full min-w-0"
        />
      </FilterField>
    </>
  )
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="entry-filters-icon">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M7 12h10m-7 6h4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="entry-filters-icon">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4m-4 5a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
    </svg>
  )
}

// Below lg the date fields sit behind a "Filters (n)" toggle so the cards stay
// near the top of a phone screen; at lg and up everything is one row as before.
function EntryLogFilters({ vehicleSearch, dateFrom, dateTo, onChange, onClear, onRefresh, refreshing, hasFilters }) {
  const { t } = useLanguage()
  const activeDateFilterCount = [dateFrom, dateTo].filter(Boolean).length
  const [datePanelOpen, setDatePanelOpen] = useState(activeDateFilterCount > 0)
  const filtersLabel = activeDateFilterCount > 0 ? `${t('filters')} (${activeDateFilterCount})` : t('filters')
  const refreshLabel = refreshing ? t('refreshing') : t('refresh')

  return (
    <Card className="entry-filters mb-4 p-4">
      <div className="entry-filters-grid">
        <FilterField label={t('labelSearchVehicle')}>
          <Input
            type="search"
            value={vehicleSearch}
            onChange={(e) => onChange('vehicleSearch', e.target.value)}
            placeholder={t('placeholderSearchVehicle')}
            autoComplete="off"
            className="entry-filters-search w-full"
          />
        </FilterField>

        <div className="entry-filters-mobile-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDatePanelOpen((open) => !open)}
            aria-expanded={datePanelOpen}
            aria-controls="entry-log-date-filters"
          >
            <FilterIcon />
            <span>{filtersLabel}</span>
          </Button>
          <Button type="button" variant="secondary" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>
            <RefreshIcon />
            <span>{refreshLabel}</span>
          </Button>
        </div>

        <div id="entry-log-date-filters" className={`entry-filters-dates ${datePanelOpen ? 'entry-filters-dates-open' : ''}`}>
          <DateFilterFields dateFrom={dateFrom} dateTo={dateTo} onChange={onChange} />
          {hasFilters && (
            <Button type="button" variant="secondary" onClick={onClear} className="entry-filters-mobile-clear">
              {t('clearFilters')}
            </Button>
          )}
        </div>

        <div className="entry-filters-desktop-actions">
          {hasFilters && (
            <Button type="button" variant="secondary" onClick={onClear}>
              {t('clearFilters')}
            </Button>
          )}
          <Button type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>
            {refreshLabel}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function EntrySectionTabs({ tabs }) {
  const { t } = useLanguage()

  return (
    <nav className="page-tabs mb-5" aria-label="Entry sections">
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.to}
          className={({ isActive }) =>
            `border-b-2 px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'page-tab page-tab-active' : 'page-tab'}`
          }
        >
          {tabLabel(tab, t)}
        </NavLink>
      ))}
    </nav>
  )
}

export default function EntriesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { section } = useParams()
  const canMarkExit = canOpenSection(user.role, ENTRY_SECTIONS.new)

  const { logFilters, updateLogFilter, clearLogFilters } = useEntryLogFilters()
  const debouncedVehicleSearch = useDebouncedValue(logFilters.vehicleSearch.trim(), VEHICLE_SEARCH_DEBOUNCE_MS)
  const hasFilters = Boolean(logFilters.vehicleSearch.trim() || logFilters.dateFrom || logFilters.dateTo)

  const { entries, loading, error, addEntry, markExit, refresh } = useEntries({
    vehicle_number: debouncedVehicleSearch,
    date_from: localDayStartIso(logFilters.dateFrom),
    date_to: localDayEndIso(logFilters.dateTo),
  })

  // Other guards register entries all the time; reopening the log must show them.
  const previousSectionRef = useRef(section)
  useEffect(() => {
    if (section === ENTRY_SECTIONS.log && previousSectionRef.current !== ENTRY_SECTIONS.log) refresh()
    previousSectionRef.current = section
  }, [section, refresh])

  // Covers unknown sections and sections this role may not open (also after
  // an admin changes the role of a signed-in user).
  if (!canOpenSection(user.role, section)) return <Navigate to={defaultRouteForRole(user.role)} replace />

  return (
    <div className="page-screen page-entries">
      <div className="page-heading mb-5">
        <div>
          <p className="page-kicker">GATE OPERATIONS</p>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
          <p className="page-description">Register arrivals, review site activity, and manage vehicle weighing.</p>
        </div>
        {user.role === ROLES.securityGuard && <LanguageSwitcher />}
      </div>

      <EntrySectionTabs tabs={entrySectionTabsForRole(user.role)} />

      {section === ENTRY_SECTIONS.new && <EntryForm onSubmit={addEntry} />}
      {section === ENTRY_SECTIONS.log && (
        <>
          <EntryLogFilters
            {...logFilters}
            onChange={updateLogFilter}
            onClear={clearLogFilters}
            onRefresh={refresh}
            refreshing={loading}
            hasFilters={hasFilters}
          />
          <EntryTable
            entries={entries}
            loading={loading}
            error={error}
            onMarkExit={markExit}
            onRetry={refresh}
            onClearFilters={clearLogFilters}
            canMarkExit={canMarkExit}
            hasFilters={hasFilters}
          />
        </>
      )}
      {section === ENTRY_SECTIONS.weighbridge && <WeighbridgeTab />}
    </div>
  )
}
