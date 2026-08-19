import { useState } from 'react'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import WeighbridgeTab from '../components/WeighbridgeTab'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'

const ALL_TABS = [
  { key: 'new', label: 'New Entry' },
  { key: 'log', label: 'Entry Log' },
  { key: 'weighbridge', label: 'Weighbridge' },
]

export default function EntriesPage() {
  const { user } = useAuth()
  const canWriteEntries = user?.role !== 'weighbridge_operator'
  const tabs = canWriteEntries ? ALL_TABS : ALL_TABS.filter((tab) => tab.key !== 'new')

  const { entries, loading, error, addEntry, markExit } = useEntries()
  const [activeTab, setActiveTab] = useState(canWriteEntries ? 'new' : 'log')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Vehicle Entry Log</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'new' && canWriteEntries && <EntryForm onSubmit={addEntry} />}
      {activeTab === 'log' && (
        <EntryTable
          entries={entries}
          loading={loading}
          error={error}
          onMarkExit={markExit}
          canMarkExit={canWriteEntries}
        />
      )}
      {activeTab === 'weighbridge' && <WeighbridgeTab />}
    </div>
  )
}
