import { lazy, Suspense, useState } from 'react'
import { useToast } from '../context/ToastContext'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'

const QrScanner = lazy(() => import('./QrScanner'))

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

export default function EntryForm({ onSubmit }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(1)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleScan = (decodedText) => {
    let scanned
    try {
      scanned = JSON.parse(decodedText)
    } catch {
      setScanning(false)
      showToast('Scanned code is not a valid document QR', 'error')
      return
    }

    setForm((prev) => ({
      ...prev,
      reference_doc_number: scanned.reference_doc_number ?? prev.reference_doc_number,
      supplier_transporter_name: scanned.supplier_transporter_name ?? prev.supplier_transporter_name,
      project_name: scanned.project_name ?? prev.project_name,
      subproject_name: scanned.subproject_name ?? prev.subproject_name,
    }))
    setScanning(false)
    showToast('Scanned data filled into the form', 'success')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        material_quantity: form.material_quantity ? Number(form.material_quantity) : null,
      }
      await onSubmit(payload)
      setForm(initialState)
      setStep(1)
      showToast('Vehicle entry registered', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save entry', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {step === 1 ? 'Step 1 of 2: Document Details' : 'Step 2 of 2: Vehicle & Material Details'}
        </h2>
        {step === 1 && !scanning && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setScanning(true)}>
            Scan Document
          </Button>
        )}
      </div>

      {step === 1 && scanning && (
        <div className="mb-4">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading scanner...</p>}>
            <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
          </Suspense>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {step === 1 ? (
          <>
            <Input name="reference_doc_number" value={form.reference_doc_number} onChange={handleChange} placeholder="Challan/Invoice/PO Number" />
            <Input name="supplier_transporter_name" value={form.supplier_transporter_name} onChange={handleChange} placeholder="Supplier/Transporter" />
            <Input name="project_name" value={form.project_name} onChange={handleChange} placeholder="Project Name" />
            <Input name="subproject_name" value={form.subproject_name} onChange={handleChange} placeholder="Subproject Name" />
            <Button type="button" onClick={() => setStep(2)} className="col-span-full sm:col-span-1">
              Next
            </Button>
          </>
        ) : (
          <>
            <Input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder="Vehicle Number" required />
            <Input name="driver_name" value={form.driver_name} onChange={handleChange} placeholder="Driver Name" required />
            <Input name="driver_phone" value={form.driver_phone} onChange={handleChange} placeholder="Driver Phone" />
            <Input name="material_description" value={form.material_description} onChange={handleChange} placeholder="Material Description" />
            <Input name="material_quantity" type="number" value={form.material_quantity} onChange={handleChange} placeholder="Quantity" />
            <Input name="material_unit" value={form.material_unit} onChange={handleChange} placeholder="Unit (kg/ton/units)" />
            <Input name="purpose" value={form.purpose} onChange={handleChange} placeholder="Purpose" />
            <div className="col-span-full flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Register Entry'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Card>
  )
}
