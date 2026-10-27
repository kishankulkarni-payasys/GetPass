import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { formatCardDateTime } from '../utils/formatDate'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import ListState from './ui/ListState'
import RecordCard, { RecordCardList } from './ui/RecordCard'

function materialText(entry) {
  const quantity = entry.material_quantity ? ` (${entry.material_quantity} ${entry.material_unit || ''})`.replace(' )', ')') : ''
  return entry.material_description ? `${entry.material_description}${quantity}` : quantity.trim()
}

function StatusBadge({ entry }) {
  const { t } = useLanguage()
  return entry.exit_time ? <Badge tone="green">{t('statusExited')}</Badge> : <Badge tone="blue">{t('statusOnSite')}</Badge>
}

function MarkExitButton({ isExiting, onClick, className = '' }) {
  const { t } = useLanguage()
  return (
    <Button variant="warning" size="sm" disabled={isExiting} aria-busy={isExiting} onClick={onClick} className={className}>
      {isExiting ? t('markingExit') : t('markExit')}
    </Button>
  )
}

function EntryCard({ entry, canMarkExit, isExiting, onMarkExit }) {
  const { t } = useLanguage()
  const showMarkExit = !entry.exit_time && canMarkExit

  return (
    <RecordCard
      caption={t('colVehicle')}
      title={entry.vehicle_number}
      badge={<StatusBadge entry={entry} />}
      details={[
        { label: t('colDriver'), value: entry.driver_name },
        { label: t('colProject'), value: entry.project_name, secondary: entry.subproject_name },
        { label: t('colMaterial'), value: materialText(entry) },
        { label: t('colEntry'), value: formatCardDateTime(entry.entry_time) },
        { label: t('colExit'), value: formatCardDateTime(entry.exit_time), hidden: !entry.exit_time },
      ]}
      actions={showMarkExit && <MarkExitButton isExiting={isExiting} onClick={() => onMarkExit(entry.id)} />}
    />
  )
}

function EntryDesktopTable({ entries, canMarkExit, exitingIds, onMarkExit }) {
  const { t } = useLanguage()

  return (
    <Card className="entry-desktop-table overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            <th>{t('colVehicle')}</th>
            <th>{t('colProject')}</th>
            <th>{t('colDriver')}</th>
            <th>{t('colMaterial')}</th>
            <th>{t('colEntry')}</th>
            <th>{t('colStatus')}</th>
            <th>{t('colAction')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="font-medium text-slate-900">{entry.vehicle_number}</td>
              <td className="text-slate-600">
                {entry.project_name || '-'}
                {entry.subproject_name ? <span className="block text-xs text-slate-400">{entry.subproject_name}</span> : null}
              </td>
              <td className="text-slate-600">{entry.driver_name}</td>
              <td className="text-slate-600">
                {entry.material_description}
                {entry.material_quantity ? ` (${entry.material_quantity} ${entry.material_unit || ''})` : ''}
              </td>
              <td className="text-slate-500">{new Date(entry.entry_time).toLocaleString()}</td>
              <td>
                {entry.exit_time ? (
                  <div className="flex flex-col gap-1">
                    <StatusBadge entry={entry} />
                    <span className="text-xs text-slate-400">{new Date(entry.exit_time).toLocaleString()}</span>
                  </div>
                ) : (
                  <StatusBadge entry={entry} />
                )}
              </td>
              <td>
                {!entry.exit_time && canMarkExit && (
                  <MarkExitButton isExiting={exitingIds.has(entry.id)} onClick={() => onMarkExit(entry.id)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export default function EntryTable({
  entries,
  loading,
  error,
  onMarkExit,
  onRetry,
  onClearFilters,
  canMarkExit = true,
  hasFilters = false,
}) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  // Several rows can be exiting at once; each stays disabled until its own request ends.
  const [exitingIds, setExitingIds] = useState(() => new Set())

  const setRowExiting = (id, isExiting) =>
    setExitingIds((prev) => {
      const next = new Set(prev)
      if (isExiting) next.add(id)
      else next.delete(id)
      return next
    })

  const handleMarkExit = async (id) => {
    if (exitingIds.has(id)) return
    setRowExiting(id, true)
    try {
      await onMarkExit(id)
      showToast(t('toastMarkedExit'), 'success')
    } catch (err) {
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || t('toastMarkExitFailed'), 'error')
    } finally {
      setRowExiting(id, false)
    }
  }

  return (
    <ListState
      loading={loading}
      error={error}
      isEmpty={entries.length === 0}
      onRetry={onRetry}
      emptyMessage={t(hasFilters ? 'noEntriesFiltered' : 'noEntries')}
      hasFilters={hasFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t('clearFilters')}
      retryLabel={t('retry')}
      loadingLabel={t('loadingEntries')}
    >
      {/* While refreshing, keep the current rows on screen (dimmed) instead of flashing a loader. */}
      <div className={`entry-results ${loading ? 'entry-results-loading' : ''}`} aria-busy={loading || undefined}>
        <RecordCardList className="entry-cards">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              canMarkExit={canMarkExit}
              isExiting={exitingIds.has(entry.id)}
              onMarkExit={handleMarkExit}
            />
          ))}
        </RecordCardList>
        <EntryDesktopTable entries={entries} canMarkExit={canMarkExit} exitingIds={exitingIds} onMarkExit={handleMarkExit} />
      </div>
    </ListState>
  )
}
