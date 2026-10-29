import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { uploadPhotos } from '../api/entries'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useIndicatorReading } from '../hooks/useIndicatorReading'
import { usePassDetail } from '../hooks/usePassDetail'
import { apiErrorMessage, translateApiDetail } from '../i18n/apiErrors'
import { WEIGHMENT_KINDS } from '../utils/weighRules'
import Button from './ui/Button'
import PlateChip from './ui/PlateChip'
import StatePill from './ui/StatePill'
import WeighCapturePanel from './WeighCapturePanel'
import WeighIndicator, { formatWeight } from './WeighIndicator'
import WeighmentHistory from './WeighmentHistory'

const PhotoCapture = lazy(() => import('./PhotoCapture'))

const UPLOAD_BUSY_KEY = 'weighbridgeToastUploadBusy'
const WEIGH_FRAME_KIND = 'weigh_frame'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// The sheet covers the page, so the page behind must not scroll under the user's thumb.
function useBodyScrollLock() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])
}

// Escape is heard on the whole document, so it still closes the sheet after a tap on a blank
// area or the backdrop has moved focus to <body>.
function useEscapeToClose(onClose) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}

// Moves focus into the dialog on open and back to the button that opened it on close.
function useDialogFocus(dialogRef, initialFocusRef) {
  useEffect(() => {
    const opener = document.activeElement
    initialFocusRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab and Shift+Tab wrap around inside the dialog.
  return (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

function WeightSummary({ pass }) {
  const { t } = useLanguage()
  const items = [
    { key: WEIGHMENT_KINDS.gross, labelKey: 'weighKindGross', value: pass.current_gross_kg },
    { key: WEIGHMENT_KINDS.tare, labelKey: 'weighKindTare', value: pass.current_tare_kg },
    { key: 'net', labelKey: 'weighNet', value: pass.net_kg },
  ]
  return (
    <dl className="weigh-summary">
      {items.map(({ key, labelKey, value }) => (
        <div key={key} className={`weigh-summary-item ${key === 'net' ? 'weigh-summary-net' : ''}`}>
          <dt>{t(labelKey)}</dt>
          <dd className="gp-mono">{value === null || value === undefined ? '—' : `${formatWeight(value)} kg`}</dd>
        </div>
      ))}
    </dl>
  )
}

function PhotoButtons({ disabled, uploading, onFiles, onCamera }) {
  const { t } = useLanguage()
  const handleFileChange = (event) => {
    // Copy first: clearing the value empties the live FileList.
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    onFiles(files)
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className={`gp-btn gp-btn-secondary gp-btn-md ${disabled ? 'gate-tile-input-disabled' : ''}`}>
        {t('weighbridgeUploadFiles')}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" disabled={disabled} onChange={handleFileChange} />
      </label>
      <Button variant="secondary" disabled={uploading} onClick={onCamera}>
        {t('weighbridgeCapturePhoto')}
      </Button>
    </div>
  )
}

// Weigh-frame photos: uploaded with kind weigh_frame and linked to the newest weighment.
function WeighFramePhotos({ pass, onUploaded }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [capturing, setCapturing] = useState(false)
  // A ref, not state, so two uploads started in the same tick still see the lock.
  const uploadingRef = useRef(false)
  const photos = (pass.photos ?? []).filter((photo) => photo.kind === WEIGH_FRAME_KIND)
  const latestWeighment = (pass.weighments ?? []).find((row) => !row.is_superseded)

  const handleUpload = async (files) => {
    if (files.length === 0) return
    if (uploadingRef.current) {
      showToast(t(UPLOAD_BUSY_KEY), 'error')
      return
    }
    uploadingRef.current = true
    setUploading(true)
    try {
      await uploadPhotos(pass.id, files, { kind: WEIGH_FRAME_KIND, weighmentId: latestWeighment?.id })
      showToast(t('weighbridgeToastPhotoUploaded'), 'success')
      onUploaded()
    } catch (err) {
      if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'weighbridgeToastUploadFailed'), 'error')
    } finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }

  const handleCaptured = (blob) => {
    setCapturing(false)
    handleUpload([new File([blob], 'weigh-frame.jpg', { type: 'image/jpeg' })])
  }

  return (
    <section aria-labelledby="weigh-photos-title" className="mt-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="weigh-photos-title" className="m-0 text-base font-bold">{t('weighFramePhotos')}</h3>
          <p className="m-0 text-sm">{t('weighFramePhotosCopy')}</p>
        </div>
        <PhotoButtons disabled={uploading || capturing} uploading={uploading} onFiles={handleUpload} onCamera={() => setCapturing(true)} />
      </div>
      {capturing && (
        <Suspense fallback={<p className="text-sm">{t('weighbridgeLoadingCamera')}</p>}>
          <PhotoCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />
        </Suspense>
      )}
      {photos.length === 0 ? (
        <div className="weighbridge-empty-photos rounded-3 p-4 text-center text-sm">{t('weighbridgeNoPhotos')}</div>
      ) : (
        <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2">
          {photos.map((photo) => (
            <div className="col" key={photo.id}>
              <img src={`/uploads/${photo.file_path}`} alt={t('weighFramePhotoAlt')} className="img-fluid w-100 rounded-3 border weighbridge-photo" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DetailBody({ detail }) {
  const { t } = useLanguage()
  const { pass, loading, failed, errorDetail, reload } = detail
  const indicator = useIndicatorReading(true)

  if (!pass && loading) return <p role="status">{t('loading')}</p>
  if (!pass && failed) {
    return (
      <div className="gp-banner gp-banner-crit" role="alert">
        {translateApiDetail(errorDetail, t, 'weighLoadFailed')}{' '}
        <Button size="sm" variant="secondary" onClick={reload}>{t('retry')}</Button>
      </div>
    )
  }
  return (
    <>
      <div className="weigh-layout">
        <div className="grid content-start gap-3">
          <WeighIndicator indicator={indicator} />
          {/* Re-mounted after each capture so its reason fields start empty. */}
          <WeighCapturePanel key={pass.weighments?.length ?? 0} pass={pass} indicator={indicator} onCaptured={reload} />
        </div>
        <div className="grid content-start gap-3">
          <WeightSummary pass={pass} />
          <h3 className="m-0 text-base font-bold">{t('weighHistory')}</h3>
          <WeighmentHistory weighments={pass.weighments ?? []} />
        </div>
      </div>
      <WeighFramePhotos pass={pass} onUploaded={reload} />
    </>
  )
}

// Weighing sheet for one pass: live indicator, capture, history, net, photos.
export default function WeighbridgeDetail({ entry, onClose }) {
  const { t } = useLanguage()
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  useBodyScrollLock()
  useEscapeToClose(onClose)
  const handleDialogKeyDown = useDialogFocus(dialogRef, closeButtonRef)
  const detail = usePassDetail(entry.id)
  // The list row until the full record arrives, then the live state after each capture.
  const current = detail.pass ?? entry

  return (
    <>
      <div className="modal-backdrop show weighbridge-backdrop" />
      <div
        ref={dialogRef}
        className="modal d-block weighbridge-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weighbridge-modal-title"
        onKeyDown={handleDialogKeyDown}
      >
        {/* Below lg it is a full-screen sheet that also covers the bottom tab bar. */}
        <div className="modal-dialog modal-fullscreen-lg-down modal-dialog-centered modal-dialog-scrollable modal-xl">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header weighbridge-modal-header">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 id="weighbridge-modal-title" className="modal-title m-0">
                  <span className="visually-hidden">{t('weighbridgeEntryEyebrow')}: </span>
                  <PlateChip number={entry.vehicle_number} size="lg" />
                </h2>
                <StatePill state={current.pass_state} passType={current.pass_type} erpStatus={current.grn?.erp_status} />
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="btn-close btn-close-white weighbridge-close"
                onClick={onClose}
                aria-label={t('close')}
              />
            </div>
            <div className="modal-body p-3 p-sm-4">
              <DetailBody detail={detail} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
