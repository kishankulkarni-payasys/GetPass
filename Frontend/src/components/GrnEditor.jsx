import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useGrnRecord } from '../hooks/useStoreWork'
import { apiErrorMessage, translateApiDetail } from '../i18n/apiErrors'
import { passDetailPath, returnPassPath } from '../navigation/navItems'
import { ERP_STATUSES } from '../utils/passStates'
import Button from './ui/Button'
import PlateChip from './ui/PlateChip'
import StatePill, { ErpStatusPill, QualityResultPill } from './ui/StatePill'
import GrnLines, { QTY_FIELDS, formatQty } from './GrnLines'
import { formatWeight } from './WeighIndicator'

const GRN_STATUS_DRAFT = 'draft'
const MAX_QTY = 999999999.999

function isValidQty(value) {
  const amount = Number(value)
  return value !== '' && Number.isFinite(amount) && amount >= 0 && amount <= MAX_QTY
}

// Lines whose typed values differ from the saved GRN, as PATCH bodies.
function changedLines(lines, values) {
  return lines
    .map((line) => {
      const edits = values[line.id] ?? {}
      const changed = QTY_FIELDS.filter((field) => field in edits && String(edits[field]) !== String(line[field]))
      if (changed.length === 0) return null
      return { id: line.id, ...Object.fromEntries(changed.map((field) => [field, Number(edits[field])])) }
    })
    .filter(Boolean)
}

function allValuesValid(values) {
  return Object.values(values).every((edits) => Object.values(edits).every(isValidQty))
}

function HeaderFacts({ grn, pass }) {
  const { t } = useLanguage()
  const facts = [
    { key: 'po', label: t('fieldPoNumber'), value: <span className="gp-mono">{pass.po_number || '—'}</span> },
    { key: 'challan', label: t('fieldChallanNumber'), value: <span className="gp-mono">{pass.challan_number || '—'}</span> },
    { key: 'inspected', label: t('grnInspectedBy'), value: grn.inspected_by_name || '—' },
    { key: 'gross', label: t('weighKindGross'), value: <span className="gp-mono">{pass.current_gross_kg == null ? '—' : `${formatWeight(pass.current_gross_kg)} kg`}</span> },
    { key: 'quality', label: t('grnQuality'), value: grn.quality_result ? <QualityResultPill result={grn.quality_result} /> : '—' },
  ]
  return (
    <dl className="grn-facts">
      {facts.map(({ key, label, value }) => (
        <div key={key} className="grn-fact">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const ERP_BANNERS = {
  [ERP_STATUSES.posted]: { className: 'gp-banner-info', messageKey: 'grnErpPosted' },
  [ERP_STATUSES.pending]: { className: 'gp-banner-crit', messageKey: 'grnErpPending' },
  [ERP_STATUSES.failed]: { className: 'gp-banner-crit', messageKey: 'grnErpFailed' },
  [ERP_STATUSES.notRequired]: { className: 'gp-banner-warn', messageKey: 'grnErpNotRequired' },
}

function ErpOutcome({ grn, onRetry, retrying }) {
  const { t } = useLanguage()
  const banner = ERP_BANNERS[grn.erp_status]
  if (!banner) return null
  const canRetry = grn.erp_status === ERP_STATUSES.pending || grn.erp_status === ERP_STATUSES.failed
  return (
    <div className={`gp-banner ${banner.className}`} role={canRetry ? 'alert' : 'status'}>
      <p className="m-0 font-semibold">
        {t(banner.messageKey)}
        {grn.erp_grn_number && <> · <span className="gp-mono">{grn.erp_grn_number}</span></>}
      </p>
      {canRetry && grn.erp_last_error && <p className="mt-1 mb-0 text-sm">{grn.erp_last_error}</p>}
      {canRetry && (
        <p className="mt-1 mb-0 text-sm">{t('grnErpAttempts', { count: grn.erp_attempts })}</p>
      )}
      {canRetry && (
        <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
          {retrying ? t('grnRetrying') : t('grnRetryPost')}
        </Button>
      )}
    </div>
  )
}

// Segregation of duty (B9): whoever captured a weight on this pass cannot approve.
function SodNotice({ grn }) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const weighers = grn.weighed_by.map(({ full_name: name }) => name).join(', ') || '—'
  return (
    <p className={`grn-sod ${grn.current_user_weighed ? 'grn-sod-blocked' : ''}`} id="grn-sod-notice">
      {t('grnSodWeighedBy')} <strong>{weighers}</strong>. {t('grnSodSignedInAs')} <strong>{user.full_name}</strong>.
      {grn.current_user_weighed && <> {t('grnSodBlocked')}</>}
    </p>
  )
}

function ApproveBar({ grn, dirty, valid, busy, onSave, onApprove }) {
  const { t } = useLanguage()
  const [confirming, setConfirming] = useState(false)
  const blocked = grn.current_user_weighed
  return (
    <div className="grn-approve-bar">
      <SodNotice grn={grn} />
      <div className="grn-approve-buttons">
        <Button variant="secondary" size="lg" onClick={onSave} disabled={!dirty || !valid || busy}>
          {t('grnSaveDraft')}
        </Button>
        {!confirming ? (
          <Button size="lg" onClick={() => setConfirming(true)} disabled={blocked || !valid || busy} aria-describedby="grn-sod-notice">
            {t('grnApprove')}
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={() => { setConfirming(false); onApprove() }} disabled={busy} aria-busy={busy}>
              {t('grnApproveConfirm')}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setConfirming(false)}>{t('cancel')}</Button>
          </>
        )}
      </div>
      {confirming && <p className="gate-review-hint m-0">{t('grnApproveWarning')}</p>}
    </div>
  )
}

function Totals({ grn }) {
  const { t } = useLanguage()
  return (
    <p className="grn-totals">
      {t('grnColReceived')}: <span className="gp-mono">{formatQty(grn.total_received_qty)}</span> ·{' '}
      {t('grnColAccepted')}: <span className="gp-mono">{formatQty(grn.total_accepted_qty)}</span> ·{' '}
      {t('grnColRejected')}: <span className="gp-mono">{formatQty(grn.total_rejected_qty)}</span>
    </p>
  )
}

function useGrnActions(record) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)

  const run = async (action, successKey) => {
    setBusy(true)
    try {
      const result = await action()
      if (successKey) showToast(t(successKey), 'success')
      return result
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'grnToastFailed'), 'error')
      return null
    } finally {
      setBusy(false)
    }
  }

  const pending = record.grn ? changedLines(record.grn.lines, values) : []
  const save = async () => {
    const saved = await run(() => record.saveLines(pending), 'grnToastSaved')
    if (saved) setValues({})
    return saved
  }
  const approve = async () => {
    // Unsaved edits are saved first so the approved GRN is what the screen shows.
    if (pending.length > 0 && !(await save())) return
    const approved = await run(record.approve, 'grnToastApproved')
    if (approved) record.reload()
  }
  const retry = () => run(record.retryPost, null)
  const changeValue = (lineId, field, value) =>
    setValues((prev) => ({ ...prev, [lineId]: { ...prev[lineId], [field]: value } }))

  return { values, busy, dirty: pending.length > 0, valid: allValuesValid(values), save, approve, retry, changeValue }
}

// GRN editor: header facts, editable lines with info flags, SoD notice,
// approve & post, and the ERP outcome with retry.
export default function GrnEditor({ entryId, onBack }) {
  const { t } = useLanguage()
  const record = useGrnRecord(entryId)
  const actions = useGrnActions(record)
  const { grn, pass } = record

  if (!grn && record.loading) return <p role="status">{t('loading')}</p>
  if (!grn) {
    return (
      <div className="gp-banner gp-banner-crit" role="alert">
        {translateApiDetail(record.errorDetail, t, 'grnLoadFailed')}{' '}
        <Button size="sm" variant="secondary" onClick={record.reload}>{t('retry')}</Button>{' '}
        <Button size="sm" variant="ghost" onClick={onBack}>{t('back')}</Button>
      </div>
    )
  }

  const editable = grn.status === GRN_STATUS_DRAFT
  return (
    <section className="grn-editor" aria-labelledby="grn-editor-title">
      <div className="grn-editor-head">
        <Button variant="ghost" size="sm" onClick={onBack}>← {t('grnBackToList')}</Button>
        <h2 id="grn-editor-title" className="m-0 flex flex-wrap items-center gap-2 text-lg font-bold">
          {t('grnEditorTitle')} <PlateChip number={pass.vehicle_number} size="md" />
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatePill state={grn.pass_state} passType={pass.pass_type} erpStatus={grn.erp_status} />
          {grn.erp_status && <ErpStatusPill status={grn.erp_status} />}
          <Link to={passDetailPath(entryId)} className="gp-link text-sm">{t('grnOpenPass')}</Link>
        </div>
        {pass.supplier_transporter_name && <p className="m-0 text-sm">{pass.supplier_transporter_name}</p>}
      </div>
      <HeaderFacts grn={grn} pass={pass} />
      {!editable && <ErpOutcome grn={grn} onRetry={actions.retry} retrying={actions.busy} />}
      {grn.return_pass_number && (
        <div className="gp-banner gp-banner-warn">
          {t('grnReturnPass')} <span className="gp-mono font-bold">{grn.return_pass_number}</span> ·{' '}
          <Link to={returnPassPath(entryId)} className="gp-link">{t('grnPrintReturnPass')}</Link>
        </div>
      )}
      <GrnLines lines={grn.lines} values={actions.values} onChange={actions.changeValue} editable={editable} />
      <Totals grn={grn} />
      {editable && !actions.valid && <p className="gate-review-hint" role="alert">{t('grnInvalidQty')}</p>}
      {editable && (
        <ApproveBar grn={grn} dirty={actions.dirty} valid={actions.valid} busy={actions.busy} onSave={actions.save} onApprove={actions.approve} />
      )}
    </section>
  )
}
