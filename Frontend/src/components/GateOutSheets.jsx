import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelPass, getPassDetail, getPassGrn, letPassOut } from '../api/gateOut'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiErrorDetail, apiErrorMessage, translateApiDetail } from '../i18n/apiErrors'
import { returnPassPath } from '../navigation/navItems'
import { formatDwell } from '../utils/dwell'
import { formatCardDateTime } from '../utils/formatDate'
import { ERP_STATUSES, PASS_TYPES } from '../utils/passStates'
import PassActionDialog from './PassActionDialog'
import Button from './ui/Button'
import PlateChip from './ui/PlateChip'
import StatePill, { ErpStatusPill } from './ui/StatePill'

// Matches CancelRequest on the server (5-200 characters).
const MIN_CANCEL_REASON = 5
const MAX_CANCEL_REASON = 200

const ERP_STATUSES_NOT_POSTED = new Set([ERP_STATUSES.pending, ERP_STATUSES.failed])

function hasRejectedMaterial(detail) {
  return Number(detail?.grn?.total_rejected_qty ?? 0) > 0
}

// Detail (GRN summary) and, when material was rejected, the GRN lines that
// list what goes back on the vehicle. General passes need neither.
function useExitDetails(pass) {
  const isInward = pass.pass_type === PASS_TYPES.inward
  const [state, setState] = useState({ loading: isInward, errorDetail: null, detail: null, rejectedLines: [] })

  const load = useCallback(async () => {
    if (!isInward) return
    setState((prev) => ({ ...prev, loading: true, errorDetail: null }))
    try {
      const detail = await getPassDetail(pass.id)
      const grn = hasRejectedMaterial(detail) ? await getPassGrn(pass.id) : null
      const rejectedLines = (grn?.lines ?? []).filter((line) => Number(line.rejected_qty) > 0)
      setState({ loading: false, errorDetail: null, detail, rejectedLines })
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, errorDetail: apiErrorDetail(err) }))
    }
  }, [isInward, pass.id])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className="mb-0 text-sm text-slate-900 [overflow-wrap:anywhere]">{children || '-'}</dd>
    </div>
  )
}

function PassFacts({ pass }) {
  const { t, locale } = useLanguage()
  const isInward = pass.pass_type === PASS_TYPES.inward
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3">
      <Fact label={t('gateOutLabelSupplier')}>{pass.supplier_transporter_name}</Fact>
      <Fact label={t('gateOutLabelDriver')}>{pass.driver_name}</Fact>
      <Fact label={t('gateOutLabelPassType')}>{t(isInward ? 'passTypeInward' : 'passTypeGeneral')}</Fact>
      <Fact label={t('logFilterState')}>
        <StatePill state={pass.pass_state} passType={pass.pass_type} erpStatus={pass.erp_status} />
      </Fact>
      {isInward && <Fact label={t('gateOutLabelPo')}><span className="gp-mono">{pass.po_number}</span></Fact>}
      {isInward && <Fact label={t('gateOutLabelChallan')}><span className="gp-mono">{pass.challan_number}</span></Fact>}
      <Fact label={t('gateOutLabelEntry')}>{formatCardDateTime(pass.entry_time, locale)}</Fact>
      <Fact label={t('gateOutLabelDwell')}><span className="gp-mono">{formatDwell(pass.dwell_minutes)}</span></Fact>
    </dl>
  )
}

function GrnStatus({ grn }) {
  const { t } = useLanguage()
  if (!grn) return null
  return (
    <div className="mb-4 rounded-xl border border-gp-line bg-gp-surface-2 p-3">
      <dl className="grid grid-cols-2 gap-3">
        <Fact label={t('gateOutLabelGrn')}><ErpStatusPill status={grn.erp_status} /></Fact>
        <Fact label={t('gateOutLabelErpNumber')}><span className="gp-mono">{grn.erp_grn_number}</span></Fact>
      </dl>
      {ERP_STATUSES_NOT_POSTED.has(grn.erp_status) && <p className="mb-0 mt-2 text-xs text-slate-600">{t('gateOutErpNote')}</p>}
    </div>
  )
}

function RejectedMaterial({ entryId, grn, lines, confirmed, onConfirmChange }) {
  const { t } = useLanguage()
  return (
    <section className="rounded-xl border border-gp-warn bg-gp-warn-wash p-3" aria-labelledby="gate-out-rejected-title">
      <h3 id="gate-out-rejected-title" className="mb-1 text-sm font-bold text-gp-warn-ink">{t('gateOutRejectedTitle')}</h3>
      {grn.return_pass_number && (
        <p className="gp-mono mb-2 text-sm text-slate-900">{t('gateOutReturnPassNo', { number: grn.return_pass_number })}</p>
      )}
      <div className="mb-3 overflow-x-auto rounded-lg bg-gp-surface">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th scope="col">{t('gateOutColMaterial')}</th>
              <th scope="col" className="text-end">{t('gateOutColRejected')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>{line.material}</td>
                <td className="gp-mono whitespace-nowrap text-end">{line.rejected_qty} {line.uom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link to={returnPassPath(entryId)} className="gp-btn gp-btn-secondary gp-btn-md mb-3 w-full sm:w-auto">
        {t('gateOutPrintReturnPass')}
      </Link>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold text-slate-900">
        <input
          type="checkbox"
          className="form-check-input mt-0.5 h-5 w-5 flex-none"
          checked={confirmed}
          onChange={(e) => onConfirmChange(e.target.checked)}
          required
        />
        <span>{t('gateOutConfirmRejected')}</span>
      </label>
    </section>
  )
}

function ExitSheetBody({ pass, details, confirmed, onConfirmChange }) {
  const { t } = useLanguage()
  if (details.loading) {
    return <p role="status" className="text-sm text-slate-600">{t('loading')}</p>
  }
  if (details.errorDetail !== null || (pass.pass_type === PASS_TYPES.inward && !details.detail)) {
    return (
      <div role="alert" className="rounded-xl border border-gp-crit bg-gp-crit-wash p-3 text-sm text-gp-crit-ink">
        <p className="mb-2">{translateApiDetail(details.errorDetail, t, 'gateOutLoadDetailFailed')}</p>
        <Button variant="secondary" size="sm" onClick={details.reload}>{t('retry')}</Button>
      </div>
    )
  }
  const grn = details.detail?.grn
  return (
    <>
      <GrnStatus grn={grn} />
      {hasRejectedMaterial(details.detail) && (
        <RejectedMaterial
          entryId={pass.id}
          grn={grn}
          lines={details.rejectedLines}
          confirmed={confirmed}
          onConfirmChange={onConfirmChange}
        />
      )}
    </>
  )
}

export function ExitSheet({ pass, onClose, onDone }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const details = useExitDetails(pass)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const needsConfirmation = hasRejectedMaterial(details.detail)
  const isInward = pass.pass_type === PASS_TYPES.inward
  const ready = !details.loading && details.errorDetail === null && (!isInward || details.detail)
  const canSubmit = ready && !submitting && (!needsConfirmation || confirmed)

  const handleExit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await letPassOut(pass.id, needsConfirmation && confirmed)
      showToast(t('gateOutToastExited'), 'success')
      onDone()
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'gateOutToastExitFailed'), 'error')
      setSubmitting(false)
    }
  }

  const footer = (
    <>
      <Button variant="secondary" size="lg" className="flex-1 sm:flex-none" onClick={onClose}>{t('close')}</Button>
      <Button size="lg" className="flex-1 sm:flex-none" onClick={handleExit} disabled={!canSubmit} aria-busy={submitting}>
        {submitting ? t('gateOutExiting') : t('gateOutConfirmExit')}
      </Button>
    </>
  )

  return (
    <PassActionDialog
      id="gate-out-exit"
      eyebrow={t('gateOutSheetEyebrow')}
      title={<PlateChip number={pass.vehicle_number} size="lg" />}
      onClose={onClose}
      footer={footer}
    >
      <PassFacts pass={pass} />
      <ExitSheetBody pass={pass} details={details} confirmed={confirmed} onConfirmChange={setConfirmed} />
    </PassActionDialog>
  )
}

export function CancelSheet({ pass, onClose, onDone }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const trimmedLength = reason.trim().length
  const tooShort = trimmedLength < MIN_CANCEL_REASON

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (tooShort || submitting) return
    setSubmitting(true)
    try {
      await cancelPass(pass.id, reason.trim())
      showToast(t('gateOutToastCancelled'), 'success')
      onDone()
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'gateOutToastCancelFailed'), 'error')
      setSubmitting(false)
    }
  }

  const footer = (
    <>
      <Button variant="secondary" size="lg" className="flex-1 sm:flex-none" onClick={onClose}>{t('gateOutKeepPass')}</Button>
      <Button type="submit" form="gate-out-cancel-form" variant="danger" size="lg" className="flex-1 sm:flex-none" disabled={submitting} aria-busy={submitting}>
        {submitting ? t('gateOutCancelling') : t('gateOutCancelPass')}
      </Button>
    </>
  )

  const showError = touched && tooShort
  return (
    <PassActionDialog
      id="gate-out-cancel"
      eyebrow={t('gateOutCancelPass')}
      title={<PlateChip number={pass.vehicle_number} size="lg" />}
      onClose={onClose}
      footer={footer}
    >
      <PassFacts pass={pass} />
      <form id="gate-out-cancel-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="gate-out-cancel-reason" className="mb-1 block text-sm font-semibold text-slate-900">
          {t('gateOutCancelReasonLabel')}
        </label>
        <textarea
          id="gate-out-cancel-reason"
          className="form-control"
          rows={3}
          maxLength={MAX_CANCEL_REASON}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showError || undefined}
          aria-describedby="gate-out-cancel-reason-hint"
          required
        />
        <div id="gate-out-cancel-reason-hint" className="mt-1 flex justify-between gap-2 text-xs text-slate-600">
          <span className={showError ? 'font-semibold text-gp-crit-ink' : ''}>
            {showError
              ? t('gateOutCancelReasonTooShort', { min: MIN_CANCEL_REASON })
              : t('gateOutCancelReasonHint', { min: MIN_CANCEL_REASON, max: MAX_CANCEL_REASON })}
          </span>
          <span className="gp-mono">{t('gateOutCancelReasonCount', { count: reason.length, max: MAX_CANCEL_REASON })}</span>
        </div>
      </form>
    </PassActionDialog>
  )
}
