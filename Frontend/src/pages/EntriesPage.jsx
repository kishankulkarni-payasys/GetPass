import { useEffect, useState } from 'react'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import LanguageSwitcher from '../components/LanguageSwitcher'
import WeighbridgeTab from '../components/WeighbridgeTab'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useEntries } from '../hooks/useEntries'

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

function EntryLogFilters({ vehicleSearch, dateFrom, dateTo, onChange, onClear, onRefresh, refreshing, hasFilters }) {
  const { t } = useLanguage()
  const labelClass = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600'

  return (
    <Card className="mb-4 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
        <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
          {t('labelSearchVehicle')}
          <Input
            type="search"
            value={vehicleSearch}
            onChange={(e) => onChange('vehicleSearch', e.target.value)}
            placeholder={t('placeholderSearchVehicle')}
            autoComplete="off"
            className="w-full"
          />
        </label>
        <label className={labelClass}>
          {t('labelDateFrom')}
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => onChange('dateFrom', e.target.value)}
            className="w-full min-w-0"
          />
        </label>
        <label className={labelClass}>
          {t('labelDateTo')}
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onChange('dateTo', e.target.value)}
            className="w-full min-w-0"
          />
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          {hasFilters && (
            <Button type="button" variant="secondary" onClick={onClear} className="flex-1 sm:flex-none">
              {t('clearFilters')}
            </Button>
          )}
          <Button type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing} className="flex-1 sm:flex-none">
            {refreshing ? t('refreshing') : t('refresh')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

const EMPTY_LOG_FILTERS = { vehicleSearch: '', dateFrom: '', dateTo: '' }

export default function EntriesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const canWriteEntries = user?.role !== 'weighbridge_operator'
  const canAccessWeighbridge = user?.role !== 'security_guard'
  const allTabs = [
    { key: 'new', label: t('tabNew') },
    { key: 'log', label: t('tabLog') },
    { key: 'weighbridge', label: 'Weighbridge' },
  ]
  const tabs = allTabs.filter((tab) =>
    tab.key === 'new' ? canWriteEntries : tab.key === 'weighbridge' ? canAccessWeighbridge : true
  )

  const [logFilters, setLogFilters] = useState(EMPTY_LOG_FILTERS)
  const debouncedVehicleSearch = useDebouncedValue(logFilters.vehicleSearch.trim(), VEHICLE_SEARCH_DEBOUNCE_MS)
  const hasFilters = Boolean(logFilters.vehicleSearch.trim() || logFilters.dateFrom || logFilters.dateTo)

  const { entries, loading, error, addEntry, markExit, refresh } = useEntries({
    vehicle_number: debouncedVehicleSearch,
    date_from: localDayStartIso(logFilters.dateFrom),
    date_to: localDayEndIso(logFilters.dateTo),
  })
  const [activeTab, setActiveTab] = useState(canWriteEntries ? 'new' : 'log')

  const handleTabClick = (key) => {
    // Other guards register entries all the time; reopening the log must show them.
    if (key === 'log' && activeTab !== 'log') refresh()
    setActiveTab(key)
  }

  const handleFilterChange = (field, value) => setLogFilters((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="page-screen page-entries">
      <div className="page-heading mb-5">
        <div>
          <p className="page-kicker">GATE OPERATIONS</p>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
          <p className="page-description">Register arrivals, review site activity, and manage vehicle weighing.</p>
        </div>
        {user?.role === 'security_guard' && <LanguageSwitcher />}
      </div>

      <div className="page-tabs mb-5" role="tablist" aria-label="Entry sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'page-tab page-tab-active'
                : 'page-tab'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'new' && canWriteEntries && <EntryForm onSubmit={addEntry} />}
      {activeTab === 'log' && (
        <>
          <EntryLogFilters
            {...logFilters}
            onChange={handleFilterChange}
            onClear={() => setLogFilters(EMPTY_LOG_FILTERS)}
            onRefresh={refresh}
            refreshing={loading}
            hasFilters={hasFilters}
          />
          <EntryTable
            entries={entries}
            loading={loading}
            error={error}
            onMarkExit={markExit}
            canMarkExit={canWriteEntries}
            hasFilters={hasFilters}
          />
        </>
      )}
      {activeTab === 'weighbridge' && canAccessWeighbridge && <WeighbridgeTab />}
    </div>
  )
}
