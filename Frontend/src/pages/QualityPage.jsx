import { useCallback, useEffect, useState } from 'react'
import { getQualityQueue } from '../api/quality'
import QualityResultForm from '../components/QualityResultForm'
import Button from '../components/ui/Button'
import ListState from '../components/ui/ListState'
import PlateChip from '../components/ui/PlateChip'
import RecordCard, { RecordCardList } from '../components/ui/RecordCard'
import StatePill, { QualityResultPill } from '../components/ui/StatePill'
import { useLanguage } from '../context/LanguageContext'
import { apiErrorDetail, translateApiDetail } from '../i18n/apiErrors'
import { formatDwell } from '../utils/dwell'
import { PASS_STATES, PASS_TYPES } from '../utils/passStates'

function useQualityQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  // { detail } with the raw server text, translated at render time.
  const [loadError, setLoadError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setQueue(await getQualityQueue())
    } catch (err) {
      setLoadError({ detail: apiErrorDetail(err) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { queue, loading, loadError, refresh }
}

function WaitingTime({ pass }) {
  const { t } = useLanguage()
  return (
    <span className={`gp-mono ${pass.over_sla ? 'font-bold text-gp-crit-ink' : ''}`}>
      {formatDwell(pass.minutes_in_state)}
      {pass.over_sla && <span className="visually-hidden"> ({t('qualityQueueOverSla')})</span>}
    </span>
  )
}

function QueueCard({ pass, onOpen }) {
  const { t } = useLanguage()
  const isCorrection = Boolean(pass.current_result)
  const labelKey = isCorrection ? 'qualityCorrectFor' : 'qualityRecordFor'
  return (
    <RecordCard
      caption={pass.supplier || t('passTypeInward')}
      title={<PlateChip number={pass.vehicle_number} size="sm" />}
      badge={<StatePill state={pass.pass_state} passType={PASS_TYPES.inward} />}
      className={pass.over_sla ? 'border-gp-crit' : ''}
      details={[
        { label: t('gateOutLabelPo'), value: <span className="gp-mono">{pass.po_number}</span> },
        { label: t('gateOutLabelChallan'), value: <span className="gp-mono">{pass.challan_number}</span> },
        { label: t('qualityQueueLinesLabel'), value: pass.challan_lines.map((line) => line.material).join(', ') },
        { label: t('qualityQueueWaiting'), value: <WaitingTime pass={pass} />, hidden: isCorrection },
        { label: t('qualityQueueResult'), value: <QualityResultPill result={pass.current_result?.result} />, hidden: !isCorrection },
      ]}
      actions={
        <Button variant={isCorrection ? 'secondary' : 'primary'} onClick={() => onOpen(pass)} aria-label={t(labelKey, { vehicle: pass.vehicle_number })}>
          {t(isCorrection ? 'qualityCorrect' : 'qualityRecord')}
        </Button>
      }
    />
  )
}

function QueueGroup({ titleId, title, hint, passes, refreshing, onOpen }) {
  return (
    <section aria-labelledby={titleId} className="mb-6">
      <h2 id={titleId} className="mb-1 text-base font-bold text-slate-900">{title}</h2>
      <p className="mb-3 text-sm text-slate-600">{hint}</p>
      <RecordCardList refreshing={refreshing} className="md:grid-cols-2 xl:grid-cols-3">
        {passes.map((pass) => <QueueCard key={pass.id} pass={pass} onOpen={onOpen} />)}
      </RecordCardList>
    </section>
  )
}

// Quality section (/entries/quality). EntriesPage already renders the page
// heading, so this renders only the section content.
export default function QualityPage() {
  const { t } = useLanguage()
  const { queue, loading, loadError, refresh } = useQualityQueue()
  const [selected, setSelected] = useState(null)
  // The API sends the queue oldest first; keep that order inside each group.
  const pending = queue.filter((pass) => pass.pass_state === PASS_STATES.qualityPending)
  const resolved = queue.filter((pass) => pass.pass_state === PASS_STATES.qualityResolved)

  const handleSaved = () => {
    setSelected(null)
    refresh()
  }

  return (
    <div className="quality-page">
      <ListState
        loading={loading}
        error={loadError ? translateApiDetail(loadError.detail, t, 'qualityQueueErrorLoad') : null}
        isEmpty={queue.length === 0}
        onRetry={refresh}
        emptyMessage={t('qualityQueueEmpty')}
        loadingLabel={t('qualityQueueLoading')}
      >
        <QueueGroup
          titleId="quality-pending"
          title={t('qualityQueuePendingTitle')}
          hint={t(pending.length > 0 ? 'qualityQueuePendingHint' : 'qualityQueueNonePending')}
          passes={pending}
          refreshing={loading}
          onOpen={setSelected}
        />
        {resolved.length > 0 && (
          <QueueGroup
            titleId="quality-resolved"
            title={t('qualityQueueResolvedTitle')}
            hint={t('qualityQueueResolvedHint')}
            passes={resolved}
            refreshing={loading}
            onOpen={setSelected}
          />
        )}
      </ListState>

      {selected && <QualityResultForm key={selected.id} pass={selected} onSaved={handleSaved} onCancel={() => setSelected(null)} />}
    </div>
  )
}
