import { useLanguage } from '../context/LanguageContext'
import { formatFullDateTime } from '../utils/formatDate'
import { PASS_STATES, isInward } from '../utils/passStates'
import Badge from './ui/Badge'

const INWARD_STEPS = [
  { id: 'gateIn', labelKey: 'passStepGateIn' },
  { id: 'weigh', labelKey: 'passStepWeigh' },
  { id: 'quality', labelKey: 'passStepQuality', hardGate: true },
  { id: 'grn', labelKey: 'passStepGrn' },
  { id: 'gateOut', labelKey: 'passStepGateOut' },
]

const GENERAL_STEPS = [
  { id: 'gateIn', labelKey: 'passStepGateIn' },
  { id: 'gateOut', labelKey: 'passStepGateOut' },
]

// Index of the step the pass is waiting on; equal to the step count when finished.
const INWARD_CURRENT_STEP = {
  [PASS_STATES.gateIn]: 1,
  [PASS_STATES.onSite]: 2,
  [PASS_STATES.qualityPending]: 2,
  [PASS_STATES.qualityResolved]: 3,
  [PASS_STATES.grnDraft]: 3,
  [PASS_STATES.grnApproved]: 4,
  [PASS_STATES.gateOut]: 5,
}

const GENERAL_CURRENT_STEP = { [PASS_STATES.gateIn]: 1, [PASS_STATES.gateOut]: 2 }

function stepStatus(index, currentIndex, step) {
  if (index < currentIndex) return 'done'
  if (index > currentIndex) return 'todo'
  return step.hardGate ? 'gate' : 'current'
}

const STEP_STATUS_KEYS = { done: 'passStepDone', current: 'passStepCurrent', gate: 'passStepHardGate', todo: 'passStepTodo' }

// Journey stepper: gate-in -> weigh -> quality (hard gate) -> GRN -> gate-out.
export function PassJourney({ pass }) {
  const { t } = useLanguage()
  if (pass.pass_state === PASS_STATES.cancelled) {
    return <div className="gp-banner gp-banner-neutral">{t('passCancelledBanner', { reason: pass.cancelled_reason || '—' })}</div>
  }
  const inward = isInward(pass)
  const steps = inward ? INWARD_STEPS : GENERAL_STEPS
  const currentIndex = (inward ? INWARD_CURRENT_STEP : GENERAL_CURRENT_STEP)[pass.pass_state] ?? 0
  return (
    <ol className="pass-journey" aria-label={t('passJourneyAria')}>
      {steps.map((step, index) => {
        const status = stepStatus(index, currentIndex, step)
        return (
          <li key={step.id} className={`pass-step pass-step-${status}`} aria-current={status === 'current' || status === 'gate' ? 'step' : undefined}>
            <span className="pass-step-dot" aria-hidden="true">{status === 'done' ? '✓' : index + 1}</span>
            <span className="pass-step-label">{t(step.labelKey)}</span>
            <span className="pass-step-status">{t(STEP_STATUS_KEYS[status])}</span>
          </li>
        )
      })}
    </ol>
  )
}

const AUDIT_ACTION_KEYS = {
  pass_created: 'auditPassCreated',
  state_changed: 'auditStateChanged',
  ocr_field_overridden: 'auditOcrOverridden',
  weighment_captured: 'auditWeighmentCaptured',
  weighment_superseded: 'auditWeighmentSuperseded',
  grn_line_edited: 'auditGrnLineEdited',
  grn_approved: 'auditGrnApproved',
  erp_post_attempt: 'auditErpPostAttempt',
  quality_result_recorded: 'auditQualityRecorded',
  quality_result_corrected: 'auditQualityCorrected',
  photo_uploaded: 'auditPhotoUploaded',
}

function auditActionLabel(action, t) {
  const key = AUDIT_ACTION_KEYS[action]
  return key ? t(key) : String(action).replaceAll('_', ' ')
}

function AuditRow({ row }) {
  const { t, locale } = useLanguage()
  const actor = row.actor_name || row.actor_service || t('auditSystem')
  const hasChange = row.old_value !== null || row.new_value !== null
  return (
    <li className="audit-row">
      <div className="audit-row-head">
        <span className="font-semibold">{auditActionLabel(row.action, t)}</span>
        {row.is_manual_override && <Badge tone="warn">{t('auditManualOverride')}</Badge>}
      </div>
      {hasChange && (
        <p className="audit-row-change">
          {row.field && <span className="gp-mono">{row.field}: </span>}
          <span className="gp-mono">{row.old_value ?? '—'}</span> → <span className="gp-mono">{row.new_value ?? '—'}</span>
        </p>
      )}
      <p className="audit-row-meta">{actor} · {formatFullDateTime(row.created_at, locale)}</p>
    </li>
  )
}

// Audit timeline, newest first (the API sends the latest 100 rows).
export default function PassTimeline({ audit }) {
  const { t } = useLanguage()
  if (!audit?.length) return <p className="text-sm">{t('auditEmpty')}</p>
  return (
    <ol className="audit-list">
      {[...audit].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((row) => <AuditRow key={row.id} row={row} />)}
    </ol>
  )
}
