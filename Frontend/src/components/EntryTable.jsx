import { Link } from 'react-router-dom'
import {
  hasPassFilters,
  matchesPassFilters,
  useEntryLogFilters,
} from '../context/EntryLogFiltersContext'
import { useLanguage } from '../context/LanguageContext'
import { passDetailPath } from '../navigation/navItems'
import { formatDwell } from '../utils/dwell'
import { formatCardDateTime, formatFullDateTime } from '../utils/formatDate'
import {
  ERP_STATUSES,
  PASS_STATE_ORDER,
  PASS_TYPES,
  passStateFilterLabelKey,
} from '../utils/passStates'
import Card from './ui/Card'
import ListState from './ui/ListState'
import PlateChip from './ui/PlateChip'
import RecordCard, { RecordCardList } from './ui/RecordCard'
import Select from './ui/Select'
import StatePill from './ui/StatePill'

const PASS_TYPE_LABEL_KEYS = {
  [PASS_TYPES.inward]: 'passTypeInward',
  [PASS_TYPES.general]: 'passTypeGeneral',
}

// Pending and failed share one pill ("GRN pending post"); the filter keeps them apart.
const ERP_FILTER_LABEL_KEYS = {
  [ERP_STATUSES.posted]: 'erpPosted',
  [ERP_STATUSES.pending]: 'logErpPending',
  [ERP_STATUSES.failed]: 'logErpFailed',
  [ERP_STATUSES.notRequired]: 'erpNotRequired',
}

function materialText(entry) {
  const quantity = entry.material_quantity ? ` (${entry.material_quantity} ${entry.material_unit || ''})`.replace(' )', ')') : ''
  return entry.material_description ? `${entry.material_description}${quantity}` : quantity.trim()
}

function passTypeText(entry, t) {
  const key = PASS_TYPE_LABEL_KEYS[entry.pass_type]
  return key ? t(key) : ''
}

// Inward passes carry a PO and a challan; general and legacy passes keep the
// old free-text reference number.
function DocumentNumbers({ entry }) {
  const { t } = useLanguage()
  if (!entry.po_number && !entry.challan_number) {
    return entry.reference_doc_number ? <span className="gp-mono">{entry.reference_doc_number}</span> : '-'
  }
  return (
    <span className="flex flex-col gap-0.5">
      {entry.po_number && <span className="gp-mono">{t('logDocPo', { number: entry.po_number })}</span>}
      {entry.challan_number && <span className="gp-mono">{t('logDocChallan', { number: entry.challan_number })}</span>}
    </span>
  )
}

// The API stops counting dwell at exit, so this is final for closed passes.
function dwellText(entry) {
  return formatDwell(entry.dwell_minutes)
}

function EntryStatePill({ entry }) {
  return <StatePill state={entry.pass_state} passType={entry.pass_type} erpStatus={entry.erp_status} />
}

function OpenPassLink({ entry, className = '' }) {
  const { t } = useLanguage()
  return (
    <Link
      to={passDetailPath(entry.id)}
      className={`gp-btn gp-btn-secondary gp-btn-sm ${className}`}
      aria-label={t('logOpenPassFor', { vehicle: entry.vehicle_number })}
    >
      {t('logOpenPass')}
    </Link>
  )
}

function EntryCard({ entry }) {
  const { t, locale } = useLanguage()
  return (
    <RecordCard
      caption={passTypeText(entry, t) || t('colVehicle')}
      title={<PlateChip number={entry.vehicle_number} size="sm" />}
      subtitle={entry.supplier_transporter_name}
      badge={<EntryStatePill entry={entry} />}
      details={[
        { label: t('logColDocuments'), value: <DocumentNumbers entry={entry} /> },
        { label: t('colDriver'), value: entry.driver_name },
        { label: t('colProject'), value: entry.project_name, secondary: entry.subproject_name, hidden: !entry.project_name },
        { label: t('colMaterial'), value: materialText(entry) },
        { label: t('colEntry'), value: formatCardDateTime(entry.entry_time, locale) },
        { label: t('colExit'), value: formatCardDateTime(entry.exit_time, locale), hidden: !entry.exit_time },
        { label: t('logColDwell'), value: <span className="gp-mono">{dwellText(entry)}</span> },
      ]}
      actions={<OpenPassLink entry={entry} />}
    />
  )
}

function EntryRow({ entry }) {
  const { t, locale } = useLanguage()
  return (
    <tr>
      <td>
        <Link to={passDetailPath(entry.id)} aria-label={t('logOpenPassFor', { vehicle: entry.vehicle_number })}>
          <PlateChip number={entry.vehicle_number} size="sm" />
        </Link>
      </td>
      <td className="text-slate-600">{passTypeText(entry, t) || '-'}</td>
      <td className="text-slate-600"><DocumentNumbers entry={entry} /></td>
      <td className="max-w-56 text-slate-600">
        <span className="block truncate" title={entry.supplier_transporter_name || entry.project_name || ''}>
          {entry.supplier_transporter_name || entry.project_name || '-'}
        </span>
        <span className="block truncate text-xs text-slate-500" title={materialText(entry)}>{materialText(entry)}</span>
      </td>
      <td className="text-slate-600">{entry.driver_name}</td>
      <td className="text-slate-500">
        {formatFullDateTime(entry.entry_time, locale)}
        {entry.exit_time && <span className="block text-xs">{formatFullDateTime(entry.exit_time, locale)}</span>}
      </td>
      <td className="gp-mono text-slate-600">{dwellText(entry)}</td>
      <td><EntryStatePill entry={entry} /></td>
      <td className="text-end"><OpenPassLink entry={entry} /></td>
    </tr>
  )
}

function EntryDesktopTable({ entries }) {
  const { t } = useLanguage()
  return (
    <Card className="entry-desktop-table overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            <th scope="col">{t('colVehicle')}</th>
            <th scope="col">{t('logColType')}</th>
            <th scope="col">{t('logColDocuments')}</th>
            <th scope="col">{t('colMaterial')}</th>
            <th scope="col">{t('colDriver')}</th>
            <th scope="col">{t('colEntry')}</th>
            <th scope="col">{t('logColDwell')}</th>
            <th scope="col">{t('colStatus')}</th>
            <th scope="col" className="text-end">{t('colAction')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
        </tbody>
      </table>
    </Card>
  )
}

function FilterSelect({ id, label, value, onChange, options, className = '' }) {
  const { t } = useLanguage()
  return (
    <label htmlFor={id} className={`flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 ${className}`}>
      {label}
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0">
        <option value="">{t('logFilterAny')}</option>
        {options.map(({ value: optionValue, labelKey }) => (
          <option key={optionValue} value={optionValue}>{t(labelKey)}</option>
        ))}
      </Select>
    </label>
  )
}

const STATE_OPTIONS = PASS_STATE_ORDER.map((state) => ({ value: state, labelKey: passStateFilterLabelKey(state) }))
const PASS_TYPE_OPTIONS = Object.entries(PASS_TYPE_LABEL_KEYS).map(([value, labelKey]) => ({ value, labelKey }))
const ERP_OPTIONS = Object.entries(ERP_FILTER_LABEL_KEYS).map(([value, labelKey]) => ({ value, labelKey }))

// State, pass type and ERP status. The vehicle and date filters sit above in EntriesPage.
function PassFilters() {
  const { t } = useLanguage()
  const { logFilters, updateLogFilter } = useEntryLogFilters()
  return (
    <div role="group" aria-label={t('logPassFiltersAria')} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <FilterSelect
        id="log-filter-state"
        label={t('logFilterState')}
        value={logFilters.passState}
        onChange={(value) => updateLogFilter('passState', value)}
        options={STATE_OPTIONS}
        className="col-span-2 sm:col-span-1"
      />
      <FilterSelect
        id="log-filter-pass-type"
        label={t('logFilterPassType')}
        value={logFilters.passType}
        onChange={(value) => updateLogFilter('passType', value)}
        options={PASS_TYPE_OPTIONS}
      />
      <FilterSelect
        id="log-filter-erp"
        label={t('logFilterErp')}
        value={logFilters.erpStatus}
        onChange={(value) => updateLogFilter('erpStatus', value)}
        options={ERP_OPTIONS}
      />
    </div>
  )
}

// Entry Log list. Exit moved to the Gate-out section, so the log only opens
// the pass detail; `onMarkExit` / `canMarkExit` from older callers are ignored.
export default function EntryTable({ entries, loading, error, onRetry, onClearFilters, hasFilters = false }) {
  const { t } = useLanguage()
  const { logFilters } = useEntryLogFilters()
  const visibleEntries = entries.filter((entry) => matchesPassFilters(entry, logFilters))
  const anyFilter = hasFilters || hasPassFilters(logFilters)

  return (
    <>
      <PassFilters />
      <ListState
        loading={loading}
        error={error}
        isEmpty={visibleEntries.length === 0}
        onRetry={onRetry}
        emptyMessage={t(anyFilter ? 'noEntriesFiltered' : 'noEntries')}
        hasFilters={anyFilter}
        onClearFilters={onClearFilters}
        loadingLabel={t('loadingEntries')}
      >
        {/* While refreshing, keep the current rows on screen (dimmed) instead of flashing a loader. */}
        <div className={`entry-results ${loading ? 'entry-results-loading' : ''}`} aria-busy={loading || undefined}>
          <RecordCardList className="entry-cards">
            {visibleEntries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
          </RecordCardList>
          <EntryDesktopTable entries={visibleEntries} />
        </div>
      </ListState>
    </>
  )
}
