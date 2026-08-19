export default function EntryTable({ entries, loading, error, onMarkExit }) {
  if (loading) return <p className="text-gray-500">Loading entries...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (entries.length === 0) return <p className="text-gray-500">No entries yet.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Driver</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Material</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Entry</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Exit</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-3 py-2">{entry.vehicle_number}</td>
              <td className="px-3 py-2">{entry.driver_name}</td>
              <td className="px-3 py-2">
                {entry.material_description} {entry.material_quantity ? `(${entry.material_quantity} ${entry.material_unit || ''})` : ''}
              </td>
              <td className="px-3 py-2">{new Date(entry.entry_time).toLocaleString()}</td>
              <td className="px-3 py-2">{entry.exit_time ? new Date(entry.exit_time).toLocaleString() : '-'}</td>
              <td className="px-3 py-2">
                {!entry.exit_time && (
                  <button
                    onClick={() => onMarkExit(entry.id)}
                    className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white"
                  >
                    Mark Exit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
