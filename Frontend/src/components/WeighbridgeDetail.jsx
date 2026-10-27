import { lazy, Suspense, useRef, useState } from 'react'
import { recordWeight, uploadPhotos } from '../api/entries'
import { useToast } from '../context/ToastContext'

const PhotoCapture = lazy(() => import('./PhotoCapture'))

// Matches the backend rule that a recorded weight must be greater than zero.
const MIN_WEIGHT = 0.01
const WEIGHT_STEP = 0.01

const UPLOAD_BUSY_MESSAGE = 'Another upload is still running. Please try again in a moment.'

export default function WeighbridgeDetail({ entry, onClose }) {
  const { showToast } = useToast()
  const [weight, setWeight] = useState(entry.gross_weight ?? '')
  const [unit, setUnit] = useState(entry.weight_unit || 'kg')
  const [photos, setPhotos] = useState(entry.photos || [])
  const [savingWeight, setSavingWeight] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [capturing, setCapturing] = useState(false)
  // A ref, not state, so two uploads started in the same tick still see the lock.
  const uploadingRef = useRef(false)

  const handleSaveWeight = async (e) => {
    e.preventDefault()
    const grossWeight = Number(weight)
    if (weight === '' || !Number.isFinite(grossWeight) || grossWeight <= 0) {
      showToast('Weight must be a number greater than 0', 'error')
      return
    }
    setSavingWeight(true)
    try {
      await recordWeight(entry.id, { gross_weight: grossWeight, weight_unit: unit })
      showToast('Weight recorded', 'success')
    } catch (err) {
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || 'Failed to record weight', 'error')
    } finally {
      setSavingWeight(false)
    }
  }

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    if (uploadingRef.current) {
      showToast(UPLOAD_BUSY_MESSAGE, 'error')
      return
    }
    uploadingRef.current = true
    setUploading(true)
    try {
      const created = await uploadPhotos(entry.id, files)
      setPhotos((prev) => [...prev, ...created])
      showToast('Photo uploaded', 'success')
    } catch (err) {
      // The session-expired toast already explains this failure.
      if (!err.isSessionExpired) showToast(err.response?.data?.detail || 'Failed to upload photo', 'error')
    } finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }

  const handleFileChange = async (e) => {
    // Copy first: clearing the value empties the live FileList.
    const files = Array.from(e.target.files || [])
    // Reset so choosing the same file again still fires onChange.
    e.target.value = ''
    await handleUpload(files)
  }

  const handleCaptured = async (blob) => {
    // Keep the camera open so the user can capture again once the running upload finishes.
    if (uploadingRef.current) {
      showToast(UPLOAD_BUSY_MESSAGE, 'error')
      return
    }
    setCapturing(false)
    await handleUpload([new File([blob], 'capture.jpg', { type: 'image/jpeg' })])
  }

  // The camera panel owns photo input while open, so a file upload can't race a capture.
  const fileInputDisabled = uploading || capturing

  return (
    <>
      <div className="modal-backdrop show weighbridge-backdrop" />
      <div className="modal d-block weighbridge-modal" role="dialog" aria-modal="true" aria-labelledby="weighbridge-modal-title">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header weighbridge-modal-header">
              <div>
                <p className="mb-1 small fw-semibold text-uppercase text-white-50">Weighbridge entry</p>
                <h2 id="weighbridge-modal-title" className="modal-title fs-5 fw-bold text-white">
                  {entry.vehicle_number}
                </h2>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body p-3 p-sm-4">
              <section className="weighbridge-weight-panel mb-4 rounded-3 p-3 p-sm-4">
                <h3 className="mb-3 fs-6 fw-bold">Record vehicle weight</h3>
                <form onSubmit={handleSaveWeight} className="row g-3 align-items-end">
                  <div className="col-12 col-sm-7">
                    <label className="form-label small fw-semibold" htmlFor="gross-weight">Gross weight</label>
                    <input
                      id="gross-weight"
                      className="form-control form-control-lg"
                      type="number"
                      min={MIN_WEIGHT}
                      step={WEIGHT_STEP}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="Enter weight"
                      required
                    />
                  </div>
                  <div className="col-5 col-sm-2">
                    <label className="form-label small fw-semibold" htmlFor="weight-unit">Unit</label>
                    <select id="weight-unit" className="form-select form-select-lg" value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="kg">kg</option>
                      <option value="ton">ton</option>
                    </select>
                  </div>
                  <div className="col-7 col-sm-3 d-grid">
                    <button className="btn btn-primary btn-lg" type="submit" disabled={savingWeight}>
                      {savingWeight ? 'Saving...' : 'Save weight'}
                    </button>
                  </div>
                </form>
              </section>

              <section aria-labelledby="weighbridge-photos-title">
                <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-3">
                  <div>
                    <h3 id="weighbridge-photos-title" className="mb-1 fs-6 fw-bold">Vehicle photos</h3>
                    <p className="mb-0 small text-secondary">Add images to document this weighbridge entry.</p>
                  </div>
                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <label
                      aria-disabled={fileInputDisabled}
                      className={`btn btn-outline-primary mb-0 ${fileInputDisabled ? 'disabled' : ''}`}
                    >
                      Upload files
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="visually-hidden"
                        disabled={fileInputDisabled}
                        onChange={handleFileChange}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={uploading}
                      onClick={() => setCapturing(true)}
                    >
                      Capture photo
                    </button>
                  </div>
                </div>

                {capturing && (
                  <Suspense fallback={<p className="small text-secondary">Loading camera...</p>}>
                    <PhotoCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />
                  </Suspense>
                )}

                <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2">
                  {photos.map((photo) => (
                    <div className="col" key={photo.id}>
                      <img
                        src={`/uploads/${photo.file_path}`}
                        alt="Vehicle attachment"
                        className="img-fluid w-100 rounded-3 border weighbridge-photo"
                      />
                    </div>
                  ))}
                  {photos.length === 0 && (
                    <div className="col-12">
                      <div className="weighbridge-empty-photos rounded-3 p-4 text-center small text-secondary">
                        No photos yet. Upload a file or capture a photo.
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
