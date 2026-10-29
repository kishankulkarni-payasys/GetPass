import { lazy, Suspense, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { usePoCheck, useOpenPassWarning } from '../hooks/useGateInChecks'
import { OCR_FIELDS, useInwardPassForm } from '../hooks/useInwardPassForm'
import { apiErrorMessage } from '../i18n/apiErrors'
import { newClientRef } from '../offline/gateInQueue'
import { SUBMIT_OUTCOMES, submitGateInPass } from '../offline/submitGateInPass'
import { readQrPayload } from '../utils/qrPayload'
import ChallanLinesEditor from './ChallanLinesEditor'
import GateInCaptureTiles from './GateInCaptureTiles'
import OcrReviewPanel from './OcrReviewPanel'
import Button from './ui/Button'
import Input from './ui/Input'

const QrScanner = lazy(() => import('./QrScanner'))

const DRIVER_NAME_MAX_LENGTH = 100
const DRIVER_PHONE_MAX_LENGTH = 20

const OUTCOME_TOASTS = {
  [SUBMIT_OUTCOMES.created]: { key: 'gateInToastCreated', type: 'success' },
  [SUBMIT_OUTCOMES.queued]: { key: 'gateInToastQueued', type: 'info' },
  [SUBMIT_OUTCOMES.photosPending]: { key: 'gateInToastPhotosPending', type: 'info' },
}

function DriverFields({ driverName, driverPhone, onChange }) {
  const { t } = useLanguage()
  return (
    <section className="gate-review" aria-labelledby="gate-driver-title">
      <div className="gate-review-head"><h3 id="gate-driver-title">{t('gateInDriverTitle')}</h3></div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <div>
          <label className="gate-field-label" htmlFor="gate-in-driver-name">{t('fieldDriverName')}<span aria-hidden="true"> *</span></label>
          <Input id="gate-in-driver-name" value={driverName} onChange={(e) => onChange({ driverName: e.target.value })} maxLength={DRIVER_NAME_MAX_LENGTH} required className="w-full min-w-0" autoComplete="off" />
        </div>
        <div>
          <label className="gate-field-label" htmlFor="gate-in-driver-phone">{t('fieldDriverPhone')}</label>
          <Input id="gate-in-driver-phone" type="tel" inputMode="tel" value={driverPhone} onChange={(e) => onChange({ driverPhone: e.target.value })} maxLength={DRIVER_PHONE_MAX_LENGTH} className="w-full min-w-0" autoComplete="off" />
        </div>
      </div>
    </section>
  )
}

function SubmitHint({ form }) {
  const { t } = useLanguage()
  if (form.unconfirmedCount > 0) return <p className="gate-action-hint">{t('gateInConfirmHighlighted', { count: form.unconfirmedCount })}</p>
  if (form.missingRequired) return <p className="gate-action-hint">{t('gateInFillRequired')}</p>
  return null
}

function QrPrefill({ onValues }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const handleScan = (decodedText) => {
    setOpen(false)
    onValues(readQrPayload(decodedText))
  }
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('gateInScanQr')}
      </Button>
    )
  }
  return (
    <Suspense fallback={<p className="text-sm">{t('loadingScanner')}</p>}>
      <QrScanner title={t('gateInScanQr')} onScan={handleScan} onClose={() => setOpen(false)} />
    </Suspense>
  )
}

// Inward material gate-in: capture plate / PO / challan, review what OCR read,
// confirm low-confidence values, then create the pass (or queue it offline).
export default function InwardPassForm({ config, online, onCreated }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const form = useInwardPassForm({ threshold: config.ocr_confidence_threshold, maxLines: config.max_challan_lines })
  const [photos, setPhotos] = useState({})
  const [clientRef, setClientRef] = useState(newClientRef)
  const [resetKey, setResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const { fields } = form.state
  const poCheck = usePoCheck(fields[OCR_FIELDS.poNumber].value, { online })
  const openPass = useOpenPassWarning(fields[OCR_FIELDS.vehicleNumber].value, { online })

  const resetAll = () => {
    form.actions.reset()
    setPhotos({})
    setClientRef(newClientRef())
    setResetKey((key) => key + 1)
  }

  const handleQrValues = (values) => {
    const poNumber = values.po_number ?? values.reference_doc_number
    form.actions.applyQr({ ...values, po_number: poNumber })
    showToast(t('gateInQrApplied'), 'success')
  }

  const handlePickPo = ({ po_number: poNumber, supplier_name: supplierName }) => {
    form.actions.setField(OCR_FIELDS.poNumber, poNumber)
    if (supplierName && !fields[OCR_FIELDS.supplier].value.trim()) form.actions.setField(OCR_FIELDS.supplier, supplierName)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.canSubmit || submitting) return
    setSubmitting(true)
    try {
      const result = await submitGateInPass({ payload: form.buildPayload(clientRef), photos, online })
      const toast = OUTCOME_TOASTS[result.outcome]
      showToast(t(toast.key), toast.type)
      onCreated(result)
      resetAll()
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'gateInToastFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const ocrActive = config.ocr_enabled && online
  return (
    <form onSubmit={handleSubmit} className="gate-in-form" noValidate>
      <div className="gate-in-toolbar">
        <p className="m-0 text-sm">{ocrActive ? t('gateInCaptureIntro') : t('gateInCaptureIntroManual')}</p>
        <QrPrefill onValues={handleQrValues} />
      </div>
      <GateInCaptureTiles
        photos={photos}
        ocrActive={ocrActive}
        disabled={submitting}
        resetKey={resetKey}
        onPhoto={(kind, file) => setPhotos((prev) => ({ ...prev, [kind]: file }))}
        onOcrResult={form.actions.applyOcr}
      />
      <div className="gate-in-review-grid">
        <OcrReviewPanel form={form} poCheck={poCheck} openPass={openPass} onPickPo={handlePickPo} />
        <div className="grid gap-4">
          <ChallanLinesEditor form={form} maxLines={config.max_challan_lines} />
          <DriverFields driverName={form.state.driverName} driverPhone={form.state.driverPhone} onChange={form.actions.setDriver} />
        </div>
      </div>
      <div className="gate-action-bar">
        <SubmitHint form={form} />
        <div className="gate-action-buttons">
          <Button variant="secondary" size="lg" onClick={resetAll} disabled={submitting}>
            {t('gateInRescan')}
          </Button>
          <Button type="submit" size="lg" disabled={!form.canSubmit || submitting} aria-busy={submitting}>
            {submitting ? t('saving') : t('gateInConfirmCreate')}
          </Button>
        </div>
      </div>
    </form>
  )
}
