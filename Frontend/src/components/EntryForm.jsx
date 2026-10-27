import { lazy, Suspense, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'

const QrScanner = lazy(() => import('./QrScanner'))

// Below lg (992px, Bootstrap's breakpoint, not Tailwind's 1024px) buttons need a 44px tap target.
const MOBILE_TAP_TARGET = 'max-[991.98px]:min-h-11'

const initialState = {
  vehicle_number: '',
  project_name: '',
  subproject_name: '',
  driver_name: '',
  driver_phone: '',
  material_description: '',
  material_quantity: '',
  material_unit: '',
  purpose: '',
  reference_doc_number: '',
  supplier_transporter_name: '',
}

// Mirrors the backend column length limits so users see the cap while typing.
const MAX_LENGTHS = {
  vehicle_number: 20,
  driver_name: 100,
  driver_phone: 20,
  material_description: 200,
  material_unit: 20,
  purpose: 50,
  reference_doc_number: 50,
  supplier_transporter_name: 100,
  project_name: 100,
  subproject_name: 100,
}

const MIN_QUANTITY = 0

// QR payloads are untrusted JSON: accept only strings/numbers, capped to the field limit.
const toScannedValue = (value, field, fallback) => {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  return String(value).slice(0, MAX_LENGTHS[field])
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const pickScannedFields = (scanned, prev, fields) =>
  Object.fromEntries(fields.map((field) => [field, toScannedValue(scanned[field], field, prev[field])]))

const parseJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const trimStringFields = (values) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  )

const DOC_QR_FIELDS = ['reference_doc_number', 'supplier_transporter_name', 'project_name', 'subproject_name']
const VEHICLE_QR_FIELDS = ['vehicle_number', 'driver_name', 'driver_phone']

export default function EntryForm({ onSubmit }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [form, setForm] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(1)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleDocScan = (decodedText) => {
    const scanned = parseJson(decodedText)
    // Only a JSON object can carry document fields; anything else would "succeed" while filling nothing.
    if (!isPlainObject(scanned)) {
      setScanning(false)
      showToast(t('toastInvalidDocQr'), 'error')
      return
    }

    setForm((prev) => ({ ...prev, ...pickScannedFields(scanned, prev, DOC_QR_FIELDS) }))
    setScanning(false)
    showToast(t('toastScannedFilled'), 'success')
  }

  const handleVehicleScan = (decodedText) => {
    const parsed = parseJson(decodedText)
    // Vehicle QRs are often just the plate: a bare JSON string or number is the plate value,
    // and plain text or any other non-object JSON falls back to the raw scanned text.
    const plate = typeof parsed === 'string' || typeof parsed === 'number' ? parsed : decodedText
    const scanned = isPlainObject(parsed) ? parsed : { vehicle_number: plate }

    setForm((prev) => ({ ...prev, ...pickScannedFields(scanned, prev, VEHICLE_QR_FIELDS) }))
    setScanning(false)
    showToast(t('toastScannedFilled'), 'success')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        ...trimStringFields(form),
        material_quantity: form.material_quantity ? Number(form.material_quantity) : null,
      }
      await onSubmit(payload)
      setForm(initialState)
      setStep(1)
      showToast(t('toastEntryRegistered'), 'success')
    } catch (err) {
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || t('toastEntryFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="entry-form-card">
      <div className="entry-form-header mb-4">
        <div>
          <p className="page-kicker">NEW VEHICLE PASS</p>
          <h2 className="mb-0 text-lg font-bold text-slate-900">
            {step === 1 ? t('step1Title') : t('step2Title')}
          </h2>
        </div>
        {!scanning && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setScanning(true)} className={`entry-scan-button ${MOBILE_TAP_TARGET}`}>
            {step === 1 ? t('scanDocument') : t('scanVehicle')}
          </Button>
        )}
      </div>

      <div className="entry-step-indicator" aria-label={`Step ${step} of 2`}>
        <span className={step === 1 ? 'entry-step entry-step-active' : 'entry-step entry-step-complete'}>
          <span>01</span> {t('stepDocumentDetails')}
        </span>
        <span className="entry-step-line" aria-hidden="true" />
        <span className={step === 2 ? 'entry-step entry-step-active' : 'entry-step'}>
          <span>02</span> {t('stepVehicleDetails')}
        </span>
      </div>

      {scanning && (
        <div className="mb-4">
          <Suspense fallback={<p className="text-sm text-slate-500">{t('loadingScanner')}</p>}>
            <QrScanner
              title={step === 1 ? t('scanDocumentQr') : t('scanVehicleQr')}
              onScan={step === 1 ? handleDocScan : handleVehicleScan}
              onClose={() => setScanning(false)}
            />
          </Suspense>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {step === 1 ? (
          <>
            <Input name="reference_doc_number" value={form.reference_doc_number} onChange={handleChange} maxLength={MAX_LENGTHS.reference_doc_number} placeholder={t('placeholderRefDoc')} />
            <Input name="supplier_transporter_name" value={form.supplier_transporter_name} onChange={handleChange} maxLength={MAX_LENGTHS.supplier_transporter_name} placeholder={t('placeholderSupplier')} />
            <Input name="project_name" value={form.project_name} onChange={handleChange} maxLength={MAX_LENGTHS.project_name} placeholder={t('placeholderProject')} />
            <Input name="subproject_name" value={form.subproject_name} onChange={handleChange} maxLength={MAX_LENGTHS.subproject_name} placeholder={t('placeholderSubproject')} />
            <Button type="button" onClick={() => setStep(2)} className={`col-span-full sm:col-span-1 ${MOBILE_TAP_TARGET}`}>
              {t('next')}
            </Button>
          </>
        ) : (
          <>
            <Input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} maxLength={MAX_LENGTHS.vehicle_number} placeholder={t('placeholderVehicleNumber')} required />
            <Input name="driver_name" value={form.driver_name} onChange={handleChange} maxLength={MAX_LENGTHS.driver_name} placeholder={t('placeholderDriverName')} required />
            <Input name="driver_phone" value={form.driver_phone} onChange={handleChange} maxLength={MAX_LENGTHS.driver_phone} placeholder={t('placeholderDriverPhone')} />
            <Input name="material_description" value={form.material_description} onChange={handleChange} maxLength={MAX_LENGTHS.material_description} placeholder={t('placeholderMaterialDescription')} />
            <Input name="material_quantity" type="number" min={MIN_QUANTITY} value={form.material_quantity} onChange={handleChange} placeholder={t('placeholderQuantity')} />
            <Input name="material_unit" value={form.material_unit} onChange={handleChange} maxLength={MAX_LENGTHS.material_unit} placeholder={t('placeholderUnit')} />
            <Input name="purpose" value={form.purpose} onChange={handleChange} maxLength={MAX_LENGTHS.purpose} placeholder={t('placeholderPurpose')} />
            <div className="col-span-full flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} className={MOBILE_TAP_TARGET}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={submitting} className={MOBILE_TAP_TARGET}>
                {submitting ? t('saving') : t('registerEntry')}
              </Button>
            </div>
          </>
        )}
      </form>
    </Card>
  )
}
