import { useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import WeighbridgeDetail from './WeighbridgeDetail'

export default function WeighbridgeTab() {
  const [showAll, setShowAll] = useState(false)
  const { entries, loading, error, refresh } = useEntries(showAll ? {} : { weighed: false })
  const [selectedEntry, setSelectedEntry] = useState(null)

  const handleClose = async () => {
    setSelectedEntry(null)
    await refresh()
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button variant={showAll ? 'secondary' : 'primary'} size="sm" onClick={() => setShowAll(false)}>
          Pending
        </Button>
        <Button variant={showAll ? 'primary' : 'secondary'} size="sm" onClick={() => setShowAll(true)}>
          All
        </Button>
      </div>

      {loading && <p className="text-slate-500">Loading entries...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && entries.length === 0 && <p className="text-slate-500">No entries to show.</p>}

      {!loading && !error && entries.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Entry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Weight</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.vehicle_number}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.driver_name}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.material_description || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(entry.entry_time).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {entry.gross_weight ? (
                      <Badge tone="green">{entry.gross_weight} {entry.weight_unit}</Badge>
                    ) : (
                      <Badge tone="blue">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" onClick={() => setSelectedEntry(entry)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selectedEntry && <WeighbridgeDetail entry={selectedEntry} onClose={handleClose} />}
    </div>
  )
}
