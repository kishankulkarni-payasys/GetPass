import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'

export default function EntryTable({ entries, loading, error, onMarkExit, canMarkExit = true, hasFilters = false }) {
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

  // While refreshing, keep the current rows on screen instead of flashing a
  // loading message; only show it when there is nothing to display yet.
  if (loading && entries.length === 0) return <p className="text-slate-500">{t('loadingEntries')}</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (entries.length === 0) return <p className="text-slate-500">{t(hasFilters ? 'noEntriesFiltered' : 'noEntries')}</p>

  return (
    <div className={`entry-results ${loading ? 'entry-results-loading' : ''}`}>
      <div className="entry-cards">
        {entries.map((entry) => (
          <article key={entry.id} className="entry-mobile-card">
            <div className="entry-mobile-card-top">
              <div>
                <span className="entry-mobile-label">{t('colVehicle')}</span>
                <h2>{entry.vehicle_number}</h2>
              </div>
              {entry.exit_time ? <Badge tone="green">{t('statusExited')}</Badge> : <Badge tone="blue">{t('statusOnSite')}</Badge>}
            </div>
            <dl className="entry-mobile-details">
              <dt>{t('colProject')}</dt>
              <dd>
                {entry.project_name || '-'}
                {entry.subproject_name && <span>{entry.subproject_name}</span>}
              </dd>
              <dt>{t('colDriver')}</dt>
              <dd>{entry.driver_name}</dd>
              <dt>{t('colMaterial')}</dt>
              <dd>
                {entry.material_description || '-'}
                {entry.material_quantity ? ` (${entry.material_quantity} ${entry.material_unit || ''})` : ''}
              </dd>
              <dt>{t('colEntry')}</dt>
              <dd>{new Date(entry.entry_time).toLocaleString()}</dd>
            </dl>
            {!entry.exit_time && canMarkExit && (
              <Button
                variant="warning"
                size="sm"
                disabled={exitingIds.has(entry.id)}
                onClick={() => handleMarkExit(entry.id)}
                className="entry-mobile-action"
              >
                {t('markExit')}
              </Button>
            )}
          </article>
        ))}
      </div>

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
                      <Badge tone="green">{t('statusExited')}</Badge>
                      <span className="text-xs text-slate-400">{new Date(entry.exit_time).toLocaleString()}</span>
                    </div>
                  ) : (
                    <Badge tone="blue">{t('statusOnSite')}</Badge>
                  )}
                </td>
                <td>
                  {!entry.exit_time && canMarkExit && (
                    <Button
                      variant="warning"
                      size="sm"
                      disabled={exitingIds.has(entry.id)}
                      onClick={() => handleMarkExit(entry.id)}
                    >
                      {t('markExit')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
