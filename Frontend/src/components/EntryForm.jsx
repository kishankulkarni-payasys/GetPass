import { useState } from 'react'

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
  const [form, setForm] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        material_quantity: form.material_quantity ? Number(form.material_quantity) : null,
      }
      await onSubmit(payload)
      setForm(initialState)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder="Vehicle Number" required className="rounded border border-gray-300 px-3 py-2" />
      <input name="driver_name" value={form.driver_name} onChange={handleChange} placeholder="Driver Name" required className="rounded border border-gray-300 px-3 py-2" />
      <input name="driver_phone" value={form.driver_phone} onChange={handleChange} placeholder="Driver Phone" className="rounded border border-gray-300 px-3 py-2" />
      <input name="material_description" value={form.material_description} onChange={handleChange} placeholder="Material Description" className="rounded border border-gray-300 px-3 py-2" />
      <input name="material_quantity" type="number" value={form.material_quantity} onChange={handleChange} placeholder="Quantity" className="rounded border border-gray-300 px-3 py-2" />
      <input name="material_unit" value={form.material_unit} onChange={handleChange} placeholder="Unit (kg/ton/units)" className="rounded border border-gray-300 px-3 py-2" />
      <input name="purpose" value={form.purpose} onChange={handleChange} placeholder="Purpose" className="rounded border border-gray-300 px-3 py-2" />
      <input name="reference_doc_number" value={form.reference_doc_number} onChange={handleChange} placeholder="Challan/Invoice/PO Number" className="rounded border border-gray-300 px-3 py-2" />
      <input name="supplier_transporter_name" value={form.supplier_transporter_name} onChange={handleChange} placeholder="Supplier/Transporter" className="rounded border border-gray-300 px-3 py-2" />
      {formError && <p className="col-span-full text-sm text-red-600">{formError}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="col-span-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50 sm:col-span-1"
      >
        {submitting ? 'Saving...' : 'Register Entry'}
      </button>
    </form>
  )
}
