import EntryForm from './components/EntryForm'
import EntryTable from './components/EntryTable'
import { useEntries } from './hooks/useEntries'

function App() {
  const { entries, loading, error, addEntry, markExit } = useEntries()

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">GatePass — Vehicle Entry Log</h1>
      <div className="mb-8">
        <EntryForm onSubmit={addEntry} />
      </div>
      <EntryTable entries={entries} loading={loading} error={error} onMarkExit={markExit} />
    </div>
  )
}

export default App
