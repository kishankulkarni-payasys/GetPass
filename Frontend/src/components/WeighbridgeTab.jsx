import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEntries } from '../hooks/useEntries'
import { formatCardDateTime } from '../utils/formatDate'
import Badge from './ui/Badge'
import ListState from './ui/ListState'
import RecordCard, { RecordCardList } from './ui/RecordCard'
import WeighbridgeDetail from './WeighbridgeDetail'
import './WeighbridgeTab.css'

// The open detail sheet lives in the URL (?entry=<id>) so the phone back button closes it.
const ENTRY_PARAM = 'entry'

function isWeighed(entry) {
  return entry.gross_weight !== null && entry.gross_weight !== undefined
}

function WeightBadge({ entry }) {
  return isWeighed(entry) ? (
    <Badge tone="green">{entry.gross_weight} {entry.weight_unit}</Badge>
  ) : (
    <Badge tone="blue">Pending</Badge>
  )
}

function WeighbridgeFilter({ showAll, onChange }) {
  return (
    <div className="btn-group weighbridge-segmented" role="group" aria-label="Filter weighbridge entries">
      <button type="button" className={`btn ${showAll ? 'btn-outline-primary' : 'btn-primary'}`} aria-pressed={!showAll} onClick={() => onChange(false)}>
        Pending
      </button>
      <button type="button" className={`btn ${showAll ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={showAll} onClick={() => onChange(true)}>
        All entries
      </button>
    </div>
  )
}

function WeighbridgeCards({ entries, refreshing, onOpen }) {
  return (
    <RecordCardList refreshing={refreshing} className="d-lg-none">
      {entries.map((entry) => (
        <RecordCard
          key={entry.id}
          caption="Vehicle"
          title={entry.vehicle_number}
          badge={<WeightBadge entry={entry} />}
          details={[
            { label: 'Driver', value: entry.driver_name },
            { label: 'Material', value: entry.material_description },
            { label: 'Entry', value: formatCardDateTime(entry.entry_time) },
          ]}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => onOpen(entry)}>
              {isWeighed(entry) ? 'View details' : 'Record weight'}
            </button>
          }
        />
      ))}
    </RecordCardList>
  )
}

function WeighbridgeTable({ entries, refreshing, onOpen }) {
  return (
    <div className={`d-none d-lg-block ${refreshing ? 'weighbridge-table-refreshing' : ''}`} aria-busy={refreshing || undefined}>
      <div className="card weighbridge-table-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Vehicle</th>
                <th scope="col">Driver</th>
                <th scope="col">Material</th>
                <th scope="col">Entry</th>
                <th scope="col">Weight</th>
                <th scope="col" className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="fw-semibold">{entry.vehicle_number}</td>
                  <td>{entry.driver_name}</td>
                  <td>{entry.material_description || '-'}</td>
                  <td>{new Date(entry.entry_time).toLocaleString()}</td>
                  <td><WeightBadge entry={entry} /></td>
                  <td className="text-end">
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => onOpen(entry)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// A deep link may point at an already-weighed entry that the default Pending list filters out.
// Switch to All entries once and wait for that reload; only then drop an id that is still missing.
function useUnknownEntryFallback({ entryParam, selectedEntry, loading, error, showAll, setShowAll, dropEntryParam }) {
  const fallbackRef = useRef({ param: null, phase: 'idle' })

  useEffect(() => {
    if (!entryParam || selectedEntry) return
    const fallback = fallbackRef.current
    if (loading) {
      if (fallback.param === entryParam && fallback.phase === 'switching') fallback.phase = 'reloading'
      return
    }
    if (error) return
    if (!showAll && fallback.param !== entryParam) {
      fallbackRef.current = { param: entryParam, phase: 'switching' }
      setShowAll(true)
      return
    }
    // The All list has not started reloading yet, so the current list is still the Pending one.
    if (fallback.param === entryParam && fallback.phase === 'switching') return
    dropEntryParam()
  }, [entryParam, selectedEntry, loading, error, showAll, setShowAll, dropEntryParam])
}

// Keeps the selected entry in ?entry=<id>: opening pushes a history step, so back (or Close) pops it.
function useEntryParam({ entries, loading, error, refresh, showAll, setShowAll }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const pushedRef = useRef(false)
  const entryParam = searchParams.get(ENTRY_PARAM)
  const previousParamRef = useRef(entryParam)
  const selectedEntry = entryParam ? entries.find((entry) => String(entry.id) === entryParam) : undefined

  // The sheet just closed (Close button, Escape, or phone back), so reload to show the new weight.
  useEffect(() => {
    if (previousParamRef.current && !entryParam) {
      pushedRef.current = false
      refresh()
    }
    previousParamRef.current = entryParam
  }, [entryParam, refresh])

  // A deep link to an entry that is not in any list is dropped quietly instead of showing an error.
  const dropEntryParam = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams])
  useUnknownEntryFallback({ entryParam, selectedEntry, loading, error, showAll, setShowAll, dropEntryParam })

  const openEntry = (entry) => {
    pushedRef.current = true
    setSearchParams({ [ENTRY_PARAM]: String(entry.id) })
  }

  const closeEntry = () => {
    if (!entryParam) return
    // Only step back through history we added ourselves; a deep link must not leave the app.
    if (pushedRef.current) {
      pushedRef.current = false
      navigate(-1)
      return
    }
    setSearchParams({}, { replace: true })
  }

  return { selectedEntry, openEntry, closeEntry }
}

export default function WeighbridgeTab() {
  const [showAll, setShowAll] = useState(false)
  const { entries, loading, error, refresh } = useEntries(showAll ? {} : { weighed: false })
  const { selectedEntry, openEntry, closeEntry } = useEntryParam({ entries, loading, error, refresh, showAll, setShowAll })

  return (
    <div className="weighbridge-page">
      <div className="weighbridge-toolbar d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4">
        {/* Below lg the mobile top bar already shows the "Weighbridge" title. */}
        <div className="d-none d-lg-block">
          <h2 className="mb-1 h5 fw-bold">Weighbridge</h2>
          <p className="mb-0 small text-secondary">Review vehicle entries and record measured weights.</p>
        </div>
        <WeighbridgeFilter showAll={showAll} onChange={setShowAll} />
      </div>

      <ListState
        loading={loading}
        error={error}
        isEmpty={entries.length === 0}
        onRetry={refresh}
        emptyMessage={showAll ? 'There are no weighbridge entries yet.' : 'All vehicles have a recorded weight.'}
        loadingLabel="Loading entries..."
      >
        <WeighbridgeCards entries={entries} refreshing={loading} onOpen={openEntry} />
        <WeighbridgeTable entries={entries} refreshing={loading} onOpen={openEntry} />
      </ListState>

      {selectedEntry && <WeighbridgeDetail key={selectedEntry.id} entry={selectedEntry} onClose={closeEntry} />}
    </div>
  )
}
