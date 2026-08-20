import { useState } from 'react'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import LanguageSwitcher from '../components/LanguageSwitcher'
import WeighbridgeTab from '../components/WeighbridgeTab'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useEntries } from '../hooks/useEntries'

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

  const { entries, loading, error, addEntry, markExit } = useEntries()
  const [activeTab, setActiveTab] = useState(canWriteEntries ? 'new' : 'log')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
        {user?.role === 'security_guard' && <LanguageSwitcher />}
      </div>

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
      {activeTab === 'weighbridge' && canAccessWeighbridge && <WeighbridgeTab />}
    </div>
  )
}
