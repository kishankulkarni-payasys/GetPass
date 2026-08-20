import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'

export default function EntryTable({ entries, loading, error, onMarkExit, canMarkExit = true }) {
  const { t } = useLanguage()
  const { showToast } = useToast()

  const handleMarkExit = async (id) => {
    try {
      await onMarkExit(id)
      showToast(t('toastMarkedExit'), 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || t('toastMarkExitFailed'), 'error')
    }
  }

  if (loading) return <p className="text-slate-500">{t('loadingEntries')}</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (entries.length === 0) return <p className="text-slate-500">{t('noEntries')}</p>

  return (
    <Card className="overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colVehicle')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colProject')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colDriver')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colMaterial')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colEntry')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colStatus')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colAction')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{entry.vehicle_number}</td>
              <td className="px-4 py-3 text-slate-600">
                {entry.project_name || '-'}
                {entry.subproject_name ? <span className="block text-xs text-slate-400">{entry.subproject_name}</span> : null}
              </td>
              <td className="px-4 py-3 text-slate-600">{entry.driver_name}</td>
              <td className="px-4 py-3 text-slate-600">
                {entry.material_description}
                {entry.material_quantity ? ` (${entry.material_quantity} ${entry.material_unit || ''})` : ''}
              </td>
              <td className="px-4 py-3 text-slate-500">{new Date(entry.entry_time).toLocaleString()}</td>
              <td className="px-4 py-3">
                {entry.exit_time ? (
                  <div className="flex flex-col gap-1">
                    <Badge tone="green">{t('statusExited')}</Badge>
                    <span className="text-xs text-slate-400">{new Date(entry.exit_time).toLocaleString()}</span>
                  </div>
                ) : (
                  <Badge tone="blue">{t('statusOnSite')}</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                {!entry.exit_time && canMarkExit && (
                  <Button variant="warning" size="sm" onClick={() => handleMarkExit(entry.id)}>
                    {t('markExit')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
