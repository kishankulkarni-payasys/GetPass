import { useState } from 'react'
import { captureWeighment } from '../api/weighments'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { INDICATOR_STATUS } from '../hooks/useIndicatorReading'
import { apiErrorMessage } from '../i18n/apiErrors'
import { WEIGHMENT_KINDS, WEIGHMENT_SOURCES, canCaptureGross, canCaptureTare, currentWeighment } from '../utils/weighRules'
import Button from './ui/Button'
import Input from './ui/Input'
import Select from './ui/Select'

const MIN_WEIGHT = 0.01
const MAX_WEIGHT = 99999999.99
const WEIGHT_STEP = 0.01
const MIN_REASON_LENGTH = 3
const MAX_REASON_LENGTH = 200
const WEIGHT_UNITS = ['kg', 'ton']

function isReasonValid(reason) {
  return reason.trim().length >= MIN_REASON_LENGTH
}

function ReasonField({ id, label, value, onChange }) {
  const { t } = useLanguage()
  return (
    <div>
      <label className="gate-field-label" htmlFor={id}>{label}<span aria-hidden="true"> *</span></label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={MAX_REASON_LENGTH} required className="w-full min-w-0" aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="gate-review-hint">{t('weighReasonHint', { min: MIN_REASON_LENGTH })}</p>
    </div>
  )
}

function ManualFields({ draft, setDraft, allowedKinds, needsSupersede }) {
  const { t } = useLanguage()
  const update = (patch) => setDraft((prev) => ({ ...prev, ...patch }))
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="gate-field-label" htmlFor="manual-weigh-kind">{t('weighKind')}</label>
        <Select id="manual-weigh-kind" value={draft.kind} onChange={(e) => update({ kind: e.target.value })} className="w-full">
          {allowedKinds.map((kind) => (
            <option key={kind} value={kind}>{t(kind === WEIGHMENT_KINDS.gross ? 'weighKindGross' : 'weighKindTare')}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="gate-field-label" htmlFor="manual-weigh-value">{t('weighWeight')}<span aria-hidden="true"> *</span></label>
        <Input id="manual-weigh-value" type="number" inputMode="decimal" min={MIN_WEIGHT} max={MAX_WEIGHT} step={WEIGHT_STEP} value={draft.weight} onChange={(e) => update({ weight: e.target.value })} required className="w-full min-w-0 gp-mono text-right" />
      </div>
      <div>
        <label className="gate-field-label" htmlFor="manual-weigh-unit">{t('weighbridgeUnit')}</label>
        <Select id="manual-weigh-unit" value={draft.unit} onChange={(e) => update({ unit: e.target.value })} className="w-full">
          {WEIGHT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </Select>
      </div>
      <div className="sm:col-span-3">
        <ReasonField id="manual-weigh-reason" label={t('weighManualReason')} value={draft.reason} onChange={(reason) => update({ reason })} />
      </div>
      {needsSupersede && (
        <div className="sm:col-span-3">
          <ReasonField id="manual-weigh-supersede" label={t('weighSupersedeReason')} value={draft.supersedeReason} onChange={(supersedeReason) => update({ supersedeReason })} />
        </div>
      )}
    </div>
  )
}

function isManualDraftValid(draft, needsSupersede) {
  const weight = Number(draft.weight)
  const weightValid = draft.weight !== '' && Number.isFinite(weight) && weight >= MIN_WEIGHT && weight <= MAX_WEIGHT
  return weightValid && isReasonValid(draft.reason) && (!needsSupersede || isReasonValid(draft.supersedeReason))
}

function allowedKindsFor(pass) {
  return [
    canCaptureGross(pass) && WEIGHMENT_KINDS.gross,
    canCaptureTare(pass) && WEIGHMENT_KINDS.tare,
  ].filter(Boolean)
}

// Indicator capture (only when the reading is stable) and manual entry with a reason.
// A kind that already has a current weighment needs a reason to supersede it (B5).
export default function WeighCapturePanel({ pass, indicator, onCaptured }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const allowedKinds = allowedKindsFor(pass)
  const indicatorLive = indicator.status === INDICATOR_STATUS.live
  const [manualOpen, setManualOpen] = useState(false)
  const [draft, setDraft] = useState({ kind: allowedKinds[0] ?? WEIGHMENT_KINDS.gross, weight: '', unit: 'kg', reason: '', supersedeReason: '' })
  const [supersedeFor, setSupersedeFor] = useState(null)
  const [indicatorSupersedeReason, setIndicatorSupersedeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const hasCurrent = (kind) => Boolean(currentWeighment(pass.weighments ?? [], kind))
  const showManual = manualOpen || indicator.status === INDICATOR_STATUS.unavailable

  const submit = async (body, successKey) => {
    setSaving(true)
    try {
      const row = await captureWeighment(pass.id, body)
      showToast(t(successKey), 'success')
      setSupersedeFor(null)
      setIndicatorSupersedeReason('')
      setDraft((prev) => ({ ...prev, weight: '', reason: '', supersedeReason: '' }))
      onCaptured(row)
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'weighToastFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const captureFromIndicator = (kind, supersedeReason) => {
    if (hasCurrent(kind) && !supersedeReason) {
      setSupersedeFor(kind)
      return
    }
    submit({ kind, source: WEIGHMENT_SOURCES.indicator, supersede_reason: supersedeReason || null }, 'weighToastCaptured')
  }

  const submitManual = (event) => {
    event.preventDefault()
    const needsSupersede = hasCurrent(draft.kind)
    if (!isManualDraftValid(draft, needsSupersede)) return
    submit({
      kind: draft.kind,
      source: WEIGHMENT_SOURCES.manual,
      weight: Number(draft.weight),
      unit: draft.unit,
      manual_reason: draft.reason.trim(),
      supersede_reason: needsSupersede ? draft.supersedeReason.trim() : null,
    }, 'weighToastCaptured')
  }

  if (allowedKinds.length === 0) return <div className="gp-banner gp-banner-neutral">{t('weighNotAllowedNow')}</div>

  const stable = indicatorLive && indicator.reading?.stable
  const manualKind = allowedKinds.includes(draft.kind) ? draft.kind : allowedKinds[0]
  const manualDraft = { ...draft, kind: manualKind }
  return (
    <div className="weigh-capture">
      {indicatorLive && (
        <div className="weigh-capture-buttons">
          {allowedKinds.map((kind) => (
            <Button key={kind} size="lg" disabled={!stable || saving} onClick={() => captureFromIndicator(kind)}>
              {t(kind === WEIGHMENT_KINDS.gross ? 'weighCaptureGross' : 'weighCaptureTare')}
            </Button>
          ))}
        </div>
      )}
      {indicatorLive && !stable && <p className="gate-review-hint">{t('weighWaitStable')}</p>}
      {supersedeFor && (
        <div className="gp-banner gp-banner-warn grid gap-2">
          <ReasonField id="indicator-supersede" label={t('weighSupersedeReason')} value={indicatorSupersedeReason} onChange={setIndicatorSupersedeReason} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!isReasonValid(indicatorSupersedeReason) || !stable || saving} onClick={() => captureFromIndicator(supersedeFor, indicatorSupersedeReason.trim())}>
              {t('weighRecapture')}
            </Button>
            <Button variant="secondary" onClick={() => setSupersedeFor(null)}>{t('cancel')}</Button>
          </div>
        </div>
      )}
      {indicator.status !== INDICATOR_STATUS.unavailable && (
        <Button variant="ghost" size="sm" aria-expanded={manualOpen} aria-controls="manual-weigh-form" onClick={() => setManualOpen((open) => !open)}>
          {manualOpen ? t('weighHideManual') : t('weighEnterManually')}
        </Button>
      )}
      {showManual && (
        <form id="manual-weigh-form" className="weigh-manual" onSubmit={submitManual} noValidate>
          <ManualFields draft={manualDraft} setDraft={setDraft} allowedKinds={allowedKinds} needsSupersede={hasCurrent(manualKind)} />
          <Button type="submit" className="mt-3" disabled={!isManualDraftValid(manualDraft, hasCurrent(manualKind)) || saving} aria-busy={saving}>
            {saving ? t('saving') : t('weighSaveManual')}
          </Button>
        </form>
      )}
    </div>
  )
}
