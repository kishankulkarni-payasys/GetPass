import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'

const initialState = {
  vehicle_number: '',
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
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
      showToast('Vehicle entry registered', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save entry', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Register Vehicle Entry</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder="Vehicle Number" required />
        <Input name="driver_name" value={form.driver_name} onChange={handleChange} placeholder="Driver Name" required />
        <Input name="driver_phone" value={form.driver_phone} onChange={handleChange} placeholder="Driver Phone" />
        <Input name="material_description" value={form.material_description} onChange={handleChange} placeholder="Material Description" />
        <Input name="material_quantity" type="number" value={form.material_quantity} onChange={handleChange} placeholder="Quantity" />
        <Input name="material_unit" value={form.material_unit} onChange={handleChange} placeholder="Unit (kg/ton/units)" />
        <Input name="purpose" value={form.purpose} onChange={handleChange} placeholder="Purpose" />
        <Input name="reference_doc_number" value={form.reference_doc_number} onChange={handleChange} placeholder="Challan/Invoice/PO Number" />
        <Input name="supplier_transporter_name" value={form.supplier_transporter_name} onChange={handleChange} placeholder="Supplier/Transporter" />
        <Button type="submit" disabled={submitting} className="col-span-full sm:col-span-1">
          {submitting ? 'Saving...' : 'Register Entry'}
        </Button>
      </form>
    </Card>
  )
}
