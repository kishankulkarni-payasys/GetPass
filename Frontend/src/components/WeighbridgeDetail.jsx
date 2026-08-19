import { lazy, Suspense, useState } from 'react'
import { recordWeight, uploadPhotos } from '../api/entries'
import { useToast } from '../context/ToastContext'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'
import Select from './ui/Select'

const PhotoCapture = lazy(() => import('./PhotoCapture'))

export default function WeighbridgeDetail({ entry, onClose }) {
  const { showToast } = useToast()
  const [weight, setWeight] = useState(entry.gross_weight ?? '')
  const [unit, setUnit] = useState(entry.weight_unit || 'kg')
  const [photos, setPhotos] = useState(entry.photos || [])
  const [savingWeight, setSavingWeight] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const handleSaveWeight = async (e) => {
    e.preventDefault()
    setSavingWeight(true)
    try {
      await recordWeight(entry.id, { gross_weight: Number(weight), weight_unit: unit })
      showToast('Weight recorded', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to record weight', 'error')
    } finally {
      setSavingWeight(false)
    }
  }

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const created = await uploadPhotos(entry.id, files)
      setPhotos((prev) => [...prev, ...created])
      showToast('Photo uploaded', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to upload photo', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleCaptured = async (blob) => {
    setCapturing(false)
    await handleUpload([new File([blob], 'capture.jpg', { type: 'image/jpeg' })])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <Card className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{entry.vehicle_number}</h2>
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Close
          </button>
        </div>

        <form onSubmit={handleSaveWeight} className="mb-6 flex flex-wrap items-end gap-3">
          <Input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Weight"
            required
          />
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="kg">kg</option>
            <option value="ton">ton</option>
          </Select>
          <Button type="submit" disabled={savingWeight}>
            {savingWeight ? 'Saving...' : 'Save Weight'}
          </Button>
        </form>

        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Photos</h3>
          <label className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
            Upload File
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={() => setCapturing(true)}>
            Capture Photo
          </Button>
        </div>

        {capturing && (
          <Suspense fallback={<p className="text-sm text-slate-500">Loading camera...</p>}>
            <PhotoCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />
          </Suspense>
        )}

        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={`/uploads/${photo.file_path}`}
              alt="Vehicle attachment"
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
            />
          ))}
          {photos.length === 0 && <p className="text-sm text-slate-400">No photos yet.</p>}
        </div>
      </Card>
    </div>
  )
}
