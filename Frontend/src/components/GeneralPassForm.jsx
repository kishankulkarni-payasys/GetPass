import { lazy, Suspense, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiErrorMessage } from '../i18n/apiErrors'
import { newClientRef } from '../offline/gateInQueue'
import { SUBMIT_OUTCOMES, submitGateInPass } from '../offline/submitGateInPass'
import { normalizePlate } from '../utils/plate'
import { readQrPayload } from '../utils/qrPayload'
import Button from './ui/Button'
import Input from './ui/Input'

const QrScanner = lazy(() => import('./QrScanner'))

const EMPTY_FORM = {
  vehicle_number: '',
  driver_name: '',
  driver_phone: '',
  supplier_transporter_name: '',
  reference_doc_number: '',
  project_name: '',
  subproject_name: '',
  material_description: '',
  material_quantity: '',
  material_unit: '',
  purpose: '',
}

// Field, label key (shared form keys), max length, required. Same limits as the API.
const FIELDS = [
  { name: 'vehicle_number', labelKey: 'fieldVehicleNumber', maxLength: 20, required: true, mono: true },
  { name: 'driver_name', labelKey: 'fieldDriverName', maxLength: 100, required: true },
  { name: 'driver_phone', labelKey: 'fieldDriverPhone', maxLength: 20, type: 'tel' },
  { name: 'purpose', labelKey: 'placeholderPurpose', maxLength: 50 },
  { name: 'supplier_transporter_name', labelKey: 'placeholderSupplier', maxLength: 100 },
  { name: 'reference_doc_number', labelKey: 'placeholderRefDoc', maxLength: 50, mono: true },
  { name: 'project_name', labelKey: 'placeholderProject', maxLength: 100 },
  { name: 'subproject_name', labelKey: 'placeholderSubproject', maxLength: 100 },
  { name: 'material_description', labelKey: 'placeholderMaterialDescription', maxLength: 200 },
  { name: 'material_quantity', labelKey: 'placeholderQuantity', type: 'number', mono: true },
  { name: 'material_unit', labelKey: 'placeholderUnit', maxLength: 20 },
]

const MIN_QUANTITY = 0

function buildGeneralPayload(form, clientRef, usedQr) {
  const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))
  return {
    ...trimmed,
    vehicle_number: normalizePlate(trimmed.vehicle_number),
    material_quantity: trimmed.material_quantity === '' ? null : Number(trimmed.material_quantity),
    pass_type: 'general',
    client_ref: clientRef,
    gate_in_method: usedQr ? 'qr' : 'manual',
  }
}

function FormField({ field, value, onChange }) {
  const { t } = useLanguage()
  const id = `general-pass-${field.name}`
  return (
    <div>
      <label className="gate-field-label" htmlFor={id}>
        {t(field.labelKey)}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      <Input
        id={id}
        name={field.name}
        type={field.type ?? 'text'}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        min={field.type === 'number' ? MIN_QUANTITY : undefined}
        value={value}
        onChange={onChange}
        maxLength={field.maxLength}
        required={field.required}
        className={`w-full min-w-0 ${field.mono ? 'gp-mono' : ''}`}
        autoComplete="off"
      />
    </div>
  )
}

// Other vehicles (visitor, service, outward): the old one-step in -> out pass.
export default function GeneralPassForm({ online, onCreated }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [clientRef, setClientRef] = useState(newClientRef)
  const [usedQr, setUsedQr] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = form.vehicle_number.trim() !== '' && form.driver_name.trim() !== ''

  const handleChange = ({ target: { name, value } }) => setForm((prev) => ({ ...prev, [name]: value }))

  const handleScan = (decodedText) => {
    setScanning(false)
    const values = readQrPayload(decodedText)
    setForm((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(values).filter(([key]) => key in EMPTY_FORM)) }))
    setUsedQr(true)
    showToast(t('gateInQrApplied'), 'success')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const result = await submitGateInPass({ payload: buildGeneralPayload(form, clientRef, usedQr), photos: {}, online })
      const queued = result.outcome === SUBMIT_OUTCOMES.queued
      showToast(t(queued ? 'gateInToastQueued' : 'gateInToastCreated'), queued ? 'info' : 'success')
      onCreated(result)
      setForm(EMPTY_FORM)
      setUsedQr(false)
      setClientRef(newClientRef())
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'gateInToastFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="gate-in-form" noValidate>
      <div className="gate-in-toolbar">
        <p className="m-0 text-sm">{t('gateInGeneralIntro')}</p>
        {!scanning && (
          <Button variant="secondary" size="sm" onClick={() => setScanning(true)}>
            {t('gateInScanQr')}
          </Button>
        )}
      </div>
      {scanning && (
        <Suspense fallback={<p className="text-sm">{t('loadingScanner')}</p>}>
          <QrScanner title={t('gateInScanQr')} onScan={handleScan} onClose={() => setScanning(false)} />
        </Suspense>
      )}
      <section className="gate-review p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((field) => (
            <FormField key={field.name} field={field} value={form[field.name]} onChange={handleChange} />
          ))}
        </div>
      </section>
      <div className="gate-action-bar">
        {!canSubmit && <p className="gate-action-hint">{t('gateInFillRequired')}</p>}
        <div className="gate-action-buttons">
          <Button type="submit" size="lg" disabled={!canSubmit || submitting} aria-busy={submitting}>
            {submitting ? t('saving') : t('gateInCreatePass')}
          </Button>
        </div>
      </div>
    </form>
  )
}
