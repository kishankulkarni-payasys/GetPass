import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import { useEntries } from '../hooks/useEntries'

export default function EntriesPage() {
  const { entries, loading, error, addEntry, markExit } = useEntries()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Vehicle Entry Log</h1>
      <div className="mb-8">
        <EntryForm onSubmit={addEntry} />
      </div>
      <EntryTable entries={entries} loading={loading} error={error} onMarkExit={markExit} />
    </div>
  )
}
