import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import GateOutTab from '../components/GateOutTab'
import PageHeading from '../components/PageHeading'
import WeighbridgeTab from '../components/WeighbridgeTab'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { hasPassFilters, passFilterParams, useEntryLogFilters } from '../context/EntryLogFiltersContext'
import { useLanguage } from '../context/LanguageContext'
import { useEntries } from '../hooks/useEntries'
import {
  ENTRY_SECTIONS,
  canOpenSection,
  defaultRouteForRole,
  isEntrySection,
  navGroupLabelKey,
  tabDescription,
  tabLabel,
  tabsForRole,
} from '../navigation/navItems'
import GrnPage from './GrnPage'
import QualityPage from './QualityPage'

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
  const filtersLabel = activeDateFilterCount > 0 ? t('filtersCount', { count: activeDateFilterCount }) : t('filters')
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

function EntryLogSection() {
  const { logFilters, updateLogFilter, clearLogFilters } = useEntryLogFilters()
  const debouncedVehicleSearch = useDebouncedValue(logFilters.vehicleSearch.trim(), VEHICLE_SEARCH_DEBOUNCE_MS)
  const hasFilters = Boolean(logFilters.vehicleSearch.trim() || logFilters.dateFrom || logFilters.dateTo)

  // Mounted only while the Log is open, so reopening it always loads the
  // passes other guards registered in the meantime.
  const { entries, loading, error, refresh } = useEntries({
    vehicle_number: debouncedVehicleSearch,
    date_from: localDayStartIso(logFilters.dateFrom),
    date_to: localDayEndIso(logFilters.dateTo),
    ...passFilterParams(logFilters),
  })

  return (
    <>
      <EntryLogFilters
        {...logFilters}
        onChange={updateLogFilter}
        onClear={clearLogFilters}
        onRefresh={refresh}
        refreshing={loading}
        hasFilters={hasFilters || hasPassFilters(logFilters)}
      />
      <EntryTable
        entries={entries}
        loading={loading}
        error={error}
        onRetry={refresh}
        onClearFilters={clearLogFilters}
        hasFilters={hasFilters}
      />
    </>
  )
}

const SECTION_CONTENT = {
  [ENTRY_SECTIONS.new]: EntryForm,
  [ENTRY_SECTIONS.log]: EntryLogSection,
  [ENTRY_SECTIONS.gateOut]: GateOutTab,
  [ENTRY_SECTIONS.weighbridge]: WeighbridgeTab,
  [ENTRY_SECTIONS.quality]: QualityPage,
  [ENTRY_SECTIONS.grn]: GrnPage,
}

// One route (/entries/:section) for every gate section. The sidebar and the
// bottom bar switch sections; this page shows the section's heading and content.
export default function EntriesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { section } = useParams()

  // Covers unknown sections and sections this role may not open (also after
  // an admin changes the role of a signed-in user).
  if (!isEntrySection(section) || !canOpenSection(user.role, section)) {
    return <Navigate to={defaultRouteForRole(user.role)} replace />
  }

  const tab = tabsForRole(user.role).find(({ id }) => id === section)
  const SectionContent = SECTION_CONTENT[section]

  return (
    <div className={`page-screen page-entries page-entries-${section}`}>
      <PageHeading kicker={t(navGroupLabelKey(tab.group))} title={tabLabel(tab, t)} description={tabDescription(tab, t)} />
      <SectionContent key={section} />
    </div>
  )
}
