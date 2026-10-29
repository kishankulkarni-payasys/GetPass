import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { usePassList } from '../hooks/usePassList'
import { translateApiDetail } from '../i18n/apiErrors'
import { formatCardDateTime, formatFullDateTime } from '../utils/formatDate'
import { OPEN_PASS_STATES } from '../utils/passStates'
import { hasGross, needsGross } from '../utils/weighRules'
import Badge from './ui/Badge'
import ListState from './ui/ListState'
import PlateChip from './ui/PlateChip'
import RecordCard, { RecordCardList } from './ui/RecordCard'
import StatePill from './ui/StatePill'
import WeighbridgeDetail from './WeighbridgeDetail'
import { formatWeight } from './WeighIndicator'
import './WeighbridgeTab.css'

// The open detail sheet lives in the URL (?entry=<id>) so the phone back button closes it.
const ENTRY_PARAM = 'entry'

const OPEN_FILTERS = { state: OPEN_PASS_STATES }
const ALL_FILTERS = {}

// Inward vehicles waiting for their gross weight first (they block the
// journey), then other vehicles without a weight, then the rest, oldest first.
function weighingPriority(pass) {
  if (needsGross(pass)) return pass.pass_type === 'inward' ? 0 : 1
  return 2
}

function sortForWeighing(passes) {
  return [...passes].sort(
    (a, b) => weighingPriority(a) - weighingPriority(b) || a.entry_time.localeCompare(b.entry_time),
  )
}

function WeightBadge({ pass }) {
  const { t } = useLanguage()
  if (hasGross(pass)) {
    return <Badge tone="good"><span className="gp-mono">{formatWeight(pass.gross_weight)} {pass.weight_unit}</span></Badge>
  }
  return <Badge tone={needsGross(pass) ? 'warn' : 'neutral'}>{t('weighNoGrossYet')}</Badge>
}

function WeighbridgeFilter({ showAll, onChange }) {
  const { t } = useLanguage()
  return (
    <div className="gp-segmented" role="group" aria-label={t('weighbridgeFilterAria')}>
      <button type="button" className={`gp-segment ${showAll ? '' : 'gp-segment-active'}`} aria-pressed={!showAll} onClick={() => onChange(false)}>
        {t('weighOnSite')}
      </button>
      <button type="button" className={`gp-segment ${showAll ? 'gp-segment-active' : ''}`} aria-pressed={showAll} onClick={() => onChange(true)}>
        {t('weighbridgeAllEntries')}
      </button>
    </div>
  )
}

function actionLabel(pass, t) {
  return needsGross(pass) ? t('weighCaptureGross') : t('weighbridgeOpen')
}

function WeighbridgeCards({ passes, refreshing, onOpen }) {
  const { t, locale } = useLanguage()
  return (
    <RecordCardList refreshing={refreshing} className="d-lg-none">
      {passes.map((pass) => (
        <RecordCard
          key={pass.id}
          caption={t('colVehicle')}
          title={<PlateChip number={pass.vehicle_number} size="md" />}
          badge={<StatePill state={pass.pass_state} passType={pass.pass_type} erpStatus={pass.erp_status} />}
          details={[
            { label: t('weighbridgeColWeight'), value: <WeightBadge pass={pass} /> },
            { label: t('fieldSupplier'), value: pass.supplier_transporter_name },
            { label: t('colDriver'), value: pass.driver_name },
            { label: t('colEntry'), value: formatCardDateTime(pass.entry_time, locale) },
          ]}
          actions={
            <button type="button" className="gp-btn gp-btn-primary gp-btn-md" onClick={() => onOpen(pass)}>
              {actionLabel(pass, t)}
            </button>
          }
        />
      ))}
    </RecordCardList>
  )
}

function WeighbridgeTable({ passes, refreshing, onOpen }) {
  const { t, locale } = useLanguage()
  return (
    <div className={`d-none d-lg-block ${refreshing ? 'weighbridge-table-refreshing' : ''}`} aria-busy={refreshing || undefined}>
      <div className="card weighbridge-table-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">{t('colVehicle')}</th>
                <th scope="col">{t('colStatus')}</th>
                <th scope="col">{t('fieldSupplier')}</th>
                <th scope="col">{t('colEntry')}</th>
                <th scope="col">{t('weighbridgeColWeight')}</th>
                <th scope="col" className="text-end">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {passes.map((pass) => (
                <tr key={pass.id}>
                  <td><PlateChip number={pass.vehicle_number} size="sm" /></td>
                  <td><StatePill state={pass.pass_state} passType={pass.pass_type} erpStatus={pass.erp_status} /></td>
                  <td className="weigh-cell-ellipsis" title={pass.supplier_transporter_name ?? ''}>{pass.supplier_transporter_name || '-'}</td>
                  <td>{formatFullDateTime(pass.entry_time, locale)}</td>
                  <td><WeightBadge pass={pass} /></td>
                  <td className="text-end">
                    <button type="button" className="gp-btn gp-btn-primary gp-btn-sm" onClick={() => onOpen(pass)}>
                      {actionLabel(pass, t)}
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

// A deep link may point at a closed pass that the default on-site list filters out.
// Switch to All entries once and wait for that reload; only then drop an id that is still missing.
function useUnknownEntryFallback({ entryParam, selectedEntry, loading, failed, showAll, setShowAll, dropEntryParam }) {
  const fallbackRef = useRef({ param: null, phase: 'idle' })

  useEffect(() => {
    if (!entryParam || selectedEntry) return
    const fallback = fallbackRef.current
    if (loading) {
      if (fallback.param === entryParam && fallback.phase === 'switching') fallback.phase = 'reloading'
      return
    }
    if (failed) return
    if (!showAll && fallback.param !== entryParam) {
      fallbackRef.current = { param: entryParam, phase: 'switching' }
      setShowAll(true)
      return
    }
    // The All list has not started reloading yet, so the current list is still the on-site one.
    if (fallback.param === entryParam && fallback.phase === 'switching') return
    dropEntryParam()
  }, [entryParam, selectedEntry, loading, failed, showAll, setShowAll, dropEntryParam])
}

// Keeps the selected pass in ?entry=<id>: opening pushes a history step, so back (or Close) pops it.
function useEntryParam({ passes, loading, failed, refresh, showAll, setShowAll }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const pushedRef = useRef(false)
  const entryParam = searchParams.get(ENTRY_PARAM)
  const previousParamRef = useRef(entryParam)
  const selectedEntry = entryParam ? passes.find((pass) => String(pass.id) === entryParam) : undefined

  // The sheet just closed (Close button, Escape, or phone back), so reload to show the new weight.
  useEffect(() => {
    if (previousParamRef.current && !entryParam) {
      pushedRef.current = false
      refresh()
    }
    previousParamRef.current = entryParam
  }, [entryParam, refresh])

  const dropEntryParam = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams])
  useUnknownEntryFallback({ entryParam, selectedEntry, loading, failed, showAll, setShowAll, dropEntryParam })

  const openEntry = (pass) => {
    pushedRef.current = true
    setSearchParams({ [ENTRY_PARAM]: String(pass.id) })
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

// Weighbridge section: vehicles on site (inward awaiting gross first) and the weighing sheet.
export default function WeighbridgeTab() {
  const { t } = useLanguage()
  const [showAll, setShowAll] = useState(false)
  const { passes, loading, failed, errorDetail, refresh } = usePassList(showAll ? ALL_FILTERS : OPEN_FILTERS)
  const sorted = useMemo(() => (showAll ? passes : sortForWeighing(passes)), [passes, showAll])
  const { selectedEntry, openEntry, closeEntry } = useEntryParam({ passes, loading, failed, refresh, showAll, setShowAll })
  const waitingCount = passes.filter(needsGross).length

  return (
    <div className="weighbridge-page">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="m-0 text-sm" role="status">{t('weighWaitingCount', { count: waitingCount })}</p>
        <WeighbridgeFilter showAll={showAll} onChange={setShowAll} />
      </div>

      <ListState
        loading={loading}
        error={failed ? translateApiDetail(errorDetail, t, 'errorLoadEntries') : null}
        isEmpty={sorted.length === 0}
        onRetry={refresh}
        emptyMessage={showAll ? t('weighbridgeEmptyAll') : t('weighEmptyOnSite')}
        loadingLabel={t('loadingEntries')}
      >
        <WeighbridgeCards passes={sorted} refreshing={loading} onOpen={openEntry} />
        <WeighbridgeTable passes={sorted} refreshing={loading} onOpen={openEntry} />
      </ListState>

      {selectedEntry && <WeighbridgeDetail key={selectedEntry.id} entry={selectedEntry} onClose={closeEntry} />}
    </div>
  )
}
