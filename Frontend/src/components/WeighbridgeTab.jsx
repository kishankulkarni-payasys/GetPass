import { useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import Badge from './ui/Badge'
import WeighbridgeDetail from './WeighbridgeDetail'
import './WeighbridgeTab.css'

export default function WeighbridgeTab() {
  const [showAll, setShowAll] = useState(false)
  const { entries, loading, error, refresh } = useEntries(showAll ? {} : { weighed: false })
  const [selectedEntry, setSelectedEntry] = useState(null)

  const handleClose = async () => {
    setSelectedEntry(null)
    await refresh()
  }

  return (
    <div className="weighbridge-page">
      <div className="weighbridge-toolbar d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1 h5 fw-bold">Weighbridge</h2>
          <p className="mb-0 small text-secondary">Review vehicle entries and record measured weights.</p>
        </div>
        <div className="btn-group" role="group" aria-label="Filter weighbridge entries">
          <button type="button" className={`btn ${showAll ? 'btn-outline-primary' : 'btn-primary'}`} aria-pressed={!showAll} onClick={() => setShowAll(false)}>
            Pending
          </button>
          <button type="button" className={`btn ${showAll ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={showAll} onClick={() => setShowAll(true)}>
            All entries
          </button>
        </div>
      </div>

      {loading && <div className="alert alert-light border" role="status">Loading entries...</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!loading && !error && entries.length === 0 && (
        <div className="weighbridge-empty-state rounded-4 p-4 p-sm-5 text-center">
          <div className="weighbridge-empty-icon mb-3" aria-hidden="true">WB</div>
          <h3 className="h6 fw-bold">No entries to show</h3>
          <p className="mb-0 small text-secondary">
            {showAll ? 'There are no weighbridge entries yet.' : 'All vehicles have a recorded weight.'}
          </p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <div className="d-lg-none">
            <div className="d-grid gap-3">
              {entries.map((entry) => (
                <article key={entry.id} className="card weighbridge-entry-card">
                  <div className="card-body">
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="mb-1 small text-secondary">Vehicle</p>
                        <h3 className="h6 mb-0 fw-bold text-break">{entry.vehicle_number}</h3>
                      </div>
                      {entry.gross_weight !== null && entry.gross_weight !== undefined ? (
                        <Badge tone="green">{entry.gross_weight} {entry.weight_unit}</Badge>
                      ) : (
                        <Badge tone="blue">Pending</Badge>
                      )}
                    </div>
                    <dl className="row mb-3 small">
                      <dt className="col-5 text-secondary fw-normal">Driver</dt>
                      <dd className="col-7 mb-2 text-break">{entry.driver_name || '-'}</dd>
                      <dt className="col-5 text-secondary fw-normal">Material</dt>
                      <dd className="col-7 mb-2 text-break">{entry.material_description || '-'}</dd>
                      <dt className="col-5 text-secondary fw-normal">Entry</dt>
                      <dd className="col-7 mb-0">{new Date(entry.entry_time).toLocaleString()}</dd>
                    </dl>
                    <button type="button" className="btn btn-primary w-100" onClick={() => setSelectedEntry(entry)}>
                      Open weighbridge details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="d-none d-lg-block">
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
                        <td>
                          {entry.gross_weight !== null && entry.gross_weight !== undefined ? (
                            <Badge tone="green">{entry.gross_weight} {entry.weight_unit}</Badge>
                          ) : (
                            <Badge tone="blue">Pending</Badge>
                          )}
                        </td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => setSelectedEntry(entry)}>
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
        </>
      )}

      {selectedEntry && <WeighbridgeDetail entry={selectedEntry} onClose={handleClose} />}
    </div>
  )
}
