import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useGateInConfig } from '../hooks/useGateInChecks'
import { useGateInQueue, useOnlineStatus } from '../hooks/useGateInQueue'
import { translateApiDetail } from '../i18n/apiErrors'
import { passDetailPath } from '../navigation/navItems'
import { PASS_TYPES } from '../utils/passStates'
import GeneralPassForm from './GeneralPassForm'
import InwardPassForm from './InwardPassForm'
import Button from './ui/Button'
import PlateChip from './ui/PlateChip'

const PASS_TYPE_OPTIONS = [
  { value: PASS_TYPES.inward, labelKey: 'passTypeInward' },
  { value: PASS_TYPES.general, labelKey: 'passTypeGeneral' },
]

function PassTypeSwitch({ value, onChange }) {
  const { t } = useLanguage()
  return (
    <div className="gp-segmented" role="group" aria-label={t('gateInPassTypeAria')}>
      {PASS_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`gp-segment ${value === option.value ? 'gp-segment-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  )
}

function QueueItem({ item, onRetry, onDiscard }) {
  const { t } = useLanguage()
  return (
    <li className="gate-queue-item">
      <PlateChip number={item.vehicle_number} size="sm" />
      <span className="flex-1 text-sm">{translateApiDetail(item.error, t, 'gateInQueueRefused')}</span>
      <Button size="sm" variant="secondary" onClick={() => onRetry(item.client_ref)}>{t('retry')}</Button>
      <Button size="sm" variant="ghost" onClick={() => onDiscard(item.client_ref)}>{t('gateInQueueDiscard')}</Button>
    </li>
  )
}

// Offline banner, queued count and the passes the server refused.
function QueueStatus({ online, queue }) {
  const { t } = useLanguage()
  const { pending, needsAttention, retry, discard, syncNow } = queue
  return (
    <>
      {!online && <div className="gp-banner gp-banner-warn mb-3" role="status">{t('gateInOfflineBanner')}</div>}
      {pending.length > 0 && (
        <div className="gp-banner gp-banner-info mb-3 flex flex-wrap items-center gap-2" role="status">
          <span className="flex-1">{t('gateInQueuedCount', { count: pending.length })}</span>
          {online && <Button size="sm" variant="secondary" onClick={() => syncNow()}>{t('gateInSyncNow')}</Button>}
        </div>
      )}
      {needsAttention.length > 0 && (
        <div className="gp-banner gp-banner-crit mb-3" role="alert">
          <p className="m-0 font-bold">{t('gateInNeedsAttention', { count: needsAttention.length })}</p>
          <ul className="gate-queue-list">
            {needsAttention.map((item) => (
              <QueueItem key={item.client_ref} item={item} onRetry={retry} onDiscard={discard} />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function CreatedBanner({ result, onDismiss }) {
  const { t } = useLanguage()
  if (!result?.pass) return null
  return (
    <div className="gp-banner gp-banner-good mb-3 flex flex-wrap items-center gap-2" role="status">
      <span>{t('gateInCreatedBanner')}</span>
      <PlateChip number={result.pass.vehicle_number} size="sm" />
      <Link to={passDetailPath(result.pass.id)} className="gp-link">{t('gateInOpenPass')}</Link>
      <span className="flex-1" />
      <Button size="sm" variant="ghost" onClick={onDismiss}>{t('close')}</Button>
    </div>
  )
}

// Gate-in section: inward material (OCR flow, default) or another vehicle.
export default function EntryForm() {
  const { t } = useLanguage()
  const config = useGateInConfig()
  const online = useOnlineStatus()
  const queue = useGateInQueue()
  const [passType, setPassType] = useState(PASS_TYPES.inward)
  const [lastResult, setLastResult] = useState(null)

  return (
    <div className="gate-in">
      <QueueStatus online={online} queue={queue} />
      {queue.storageError && !online && <div className="gp-banner gp-banner-crit mb-3" role="alert">{t('gateInOfflineUnavailable')}</div>}
      <CreatedBanner result={lastResult} onDismiss={() => setLastResult(null)} />
      <div className="mb-4">
        <PassTypeSwitch value={passType} onChange={setPassType} />
      </div>
      {/* Both stay mounted so switching type by mistake never loses typed data. */}
      <div hidden={passType !== PASS_TYPES.inward}>
        <InwardPassForm config={config} online={online} onCreated={setLastResult} />
      </div>
      <div hidden={passType !== PASS_TYPES.general}>
        <GeneralPassForm online={online} onCreated={setLastResult} />
      </div>
    </div>
  )
}
