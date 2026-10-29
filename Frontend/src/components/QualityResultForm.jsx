import { useState } from 'react'
import { saveQualityResult } from '../api/quality'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiErrorMessage } from '../i18n/apiErrors'
import { formatCardDateTime } from '../utils/formatDate'
import { QUALITY_RESULTS } from '../utils/passStates'
import PassActionDialog from './PassActionDialog'
import Button from './ui/Button'
import PlateChip from './ui/PlateChip'
import { QualityResultPill } from './ui/StatePill'

// NUMERIC(12,3) on the server: up to 9 whole digits and 3 decimals, never negative.
const QUANTITY_PATTERN = /^\d{1,9}(\.\d{1,3})?$/
const MAX_LINE_REMARKS = 200
const MAX_RESULT_REMARKS = 500
// Compare in thousandths so 0.1 + 0.2 still equals 0.3.
const QUANTITY_SCALE = 1000
const FORM_ID = 'quality-result-form'

function isValidQuantity(value) {
  return QUANTITY_PATTERN.test(value.trim())
}

function toThousandths(value) {
  return Math.round(Number(value) * QUANTITY_SCALE)
}

// A correction starts from the current result; a first result starts with
// everything accepted, the common case.
function initialLines(pass) {
  const current = new Map((pass.current_result?.lines ?? []).map((line) => [line.challan_line_id, line]))
  return pass.challan_lines.map((line) => {
    const previous = current.get(line.id)
    return {
      id: line.id,
      lineNo: line.line_no,
      material: line.material,
      quantity: line.quantity,
      uom: line.uom,
      accepted: String(previous ? previous.accepted_qty : line.quantity),
      rejected: String(previous ? previous.rejected_qty : 0),
      remarks: previous?.remarks ?? '',
    }
  })
}

// Rule B10, in the server's order: nothing rejected wins over nothing accepted.
function deriveQualityResult(lines) {
  if (lines.length === 0 || !lines.every((line) => isValidQuantity(line.accepted) && isValidQuantity(line.rejected))) {
    return null
  }
  if (lines.every((line) => toThousandths(line.rejected) === 0)) return QUALITY_RESULTS.approved
  if (lines.every((line) => toThousandths(line.accepted) === 0)) return QUALITY_RESULTS.rejected
  return QUALITY_RESULTS.partial
}

function QuantityInput({ id, label, value, invalid, onChange }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input
        id={id}
        className={`form-control gp-mono text-end ${invalid ? 'is-invalid' : ''}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        required
      />
    </div>
  )
}

function QuantityMismatch({ line }) {
  const { t } = useLanguage()
  if (!isValidQuantity(line.accepted) || !isValidQuantity(line.rejected)) return null
  const total = toThousandths(line.accepted) + toThousandths(line.rejected)
  if (total === toThousandths(line.quantity)) return null
  return (
    <p className="mb-0 mt-2 text-xs text-gp-warn-ink">
      {t('qualityFormQtyMismatch', { total: total / QUANTITY_SCALE, challan: line.quantity })}
    </p>
  )
}

function LineFields({ line, showErrors, onChange }) {
  const { t } = useLanguage()
  const acceptedInvalid = showErrors && !isValidQuantity(line.accepted)
  const rejectedInvalid = showErrors && !isValidQuantity(line.rejected)
  const prefix = `quality-line-${line.id}`
  return (
    <fieldset className="mb-3 rounded-xl border border-gp-line p-3">
      <legend className="float-none mb-2 w-auto p-0 text-sm font-bold text-slate-900">
        {t('qualityFormLine', { number: line.lineNo })} · {line.material}
      </legend>
      <p className="mb-2 text-xs text-slate-600">
        {t('qualityFormChallanQty')}: <span className="gp-mono font-semibold text-slate-900">{line.quantity} {line.uom}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <QuantityInput id={`${prefix}-accepted`} label={`${t('qualityFormAccepted')} (${line.uom})`} value={line.accepted} invalid={acceptedInvalid} onChange={(value) => onChange(line.id, 'accepted', value)} />
        <QuantityInput id={`${prefix}-rejected`} label={`${t('qualityFormRejected')} (${line.uom})`} value={line.rejected} invalid={rejectedInvalid} onChange={(value) => onChange(line.id, 'rejected', value)} />
      </div>
      {(acceptedInvalid || rejectedInvalid) && (
        <p id={`${prefix}-${acceptedInvalid ? 'accepted' : 'rejected'}-error`} className="mb-0 mt-1 text-xs font-semibold text-gp-crit-ink">
          {t('qualityFormInvalidQty')}
        </p>
      )}
      <QuantityMismatch line={line} />
      <label htmlFor={`${prefix}-remarks`} className="mb-1 mt-3 block text-xs font-semibold text-slate-600">{t('qualityFormLineRemarks')}</label>
      <input
        id={`${prefix}-remarks`}
        className="form-control"
        type="text"
        maxLength={MAX_LINE_REMARKS}
        value={line.remarks}
        onChange={(e) => onChange(line.id, 'remarks', e.target.value)}
      />
    </fieldset>
  )
}

function DerivedResult({ result }) {
  const { t } = useLanguage()
  return (
    <div className="mb-3 rounded-xl bg-gp-surface-2 p-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{t('qualityFormDerived')}</span>
        {result ? <QualityResultPill result={result} /> : <span className="text-xs text-slate-600">{t('qualityFormDerivedWaiting')}</span>}
      </div>
      <p className="mb-0 mt-1 text-xs text-slate-600">{t('qualityFormDerivedHint')}</p>
    </div>
  )
}

function toRequestBody(lines, remarks) {
  return {
    lines: lines.map((line) => ({
      challan_line_id: line.id,
      accepted_qty: line.accepted.trim(),
      rejected_qty: line.rejected.trim(),
      remarks: line.remarks.trim() || null,
    })),
    remarks: remarks.trim() || null,
  }
}

function useQualitySubmit(pass, onSaved) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const submit = async (body) => {
    setSubmitting(true)
    try {
      await saveQualityResult(pass.id, body)
      showToast(t('qualityToastSaved'), 'success')
      onSaved()
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'qualityToastSaveFailed'), 'error')
      setSubmitting(false)
    }
  }
  return { submitting, submit }
}

// Per challan line accepted / rejected quantity form, shown in a sheet from QualityPage.
export default function QualityResultForm({ pass, onSaved, onCancel }) {
  const { t, locale } = useLanguage()
  const [lines, setLines] = useState(() => initialLines(pass))
  const [remarks, setRemarks] = useState(pass.current_result?.remarks ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const { submitting, submit } = useQualitySubmit(pass, onSaved)
  const result = deriveQualityResult(lines)
  const previous = pass.current_result

  const updateLine = (id, field, value) =>
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)))

  const handleSubmit = (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (!result || submitting) return
    submit(toRequestBody(lines, remarks))
  }

  const footer = (
    <>
      <Button variant="secondary" size="lg" className="flex-1 sm:flex-none" onClick={onCancel}>{t('cancel')}</Button>
      <Button type="submit" form={FORM_ID} size="lg" className="flex-1 sm:flex-none" disabled={submitting} aria-busy={submitting}>
        {submitting ? t('qualityFormSaving') : t(previous ? 'qualityCorrect' : 'qualityRecord')}
      </Button>
    </>
  )

  return (
    <PassActionDialog id="quality-result" eyebrow={t('qualityFormEyebrow')} title={<PlateChip number={pass.vehicle_number} size="lg" />} onClose={onCancel} footer={footer}>
      <p className="mb-3 text-sm text-slate-600">
        {pass.supplier || '-'} · <span className="gp-mono">{t('logDocPo', { number: pass.po_number || '-' })}</span> ·{' '}
        <span className="gp-mono">{t('logDocChallan', { number: pass.challan_number || '-' })}</span>
      </p>
      {previous && (
        <p className="mb-3 text-xs text-slate-600">
          {t('qualityFormLastRecorded', { name: previous.inspected_by_name || '-', time: formatCardDateTime(previous.recorded_at, locale) })}
        </p>
      )}
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        {lines.map((line) => <LineFields key={line.id} line={line} showErrors={showErrors} onChange={updateLine} />)}
        <DerivedResult result={result} />
        <label htmlFor="quality-remarks" className="mb-1 block text-xs font-semibold text-slate-600">{t('qualityFormRemarks')}</label>
        <textarea id="quality-remarks" className="form-control" rows={2} maxLength={MAX_RESULT_REMARKS} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </form>
    </PassActionDialog>
  )
}
