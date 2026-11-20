import { Fragment, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import useCameraStream, { CAMERA_STATUS } from '../hooks/useCameraStream'
import useObjectUrl from '../hooks/useObjectUrl'
import { CAPTURE_MIME_TYPE, captureVideoFrame } from '../utils/captureVideoFrame'
import PassActionDialog from './PassActionDialog'
import Button from './ui/Button'

// A quick second press on Capture would otherwise land on "Use photo", which
// appears in the same spot, and save the photo before it is reviewed.
const USE_PHOTO_GUARD_MS = 600

// The two modes are keyed so React builds separate buttons instead of turning
// the Capture node into "Use photo" under the pointer.
function CameraFooter({ shot, frameReady, captureRef, retakeRef, onCancel, onCapture, onRetake, onUse }) {
  const { t } = useLanguage()
  if (shot) {
    return (
      <Fragment key="review">
        <Button ref={retakeRef} variant="secondary" size="lg" className="flex-1" onClick={onRetake}>{t('gateInCameraRetake')}</Button>
        <Button size="lg" className="flex-1" onClick={onUse}>{t('gateInCameraUsePhoto')}</Button>
      </Fragment>
    )
  }
  return (
    <Fragment key="preview">
      <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel}>{t('cancel')}</Button>
      <Button ref={captureRef} size="lg" className="flex-1" disabled={!frameReady} onClick={onCapture}>
        {t('gateInCameraCapture')}
      </Button>
    </Fragment>
  )
}

function CameraStage({ videoRef, shotUrl, frameReady, documentLabel, onFrameReady }) {
  const { t } = useLanguage()
  return (
    <div className="camera-capture-stage">
      {/* The video stays mounted under the still so "Retake" is instant. */}
      <video
        ref={videoRef}
        className={`camera-capture-media ${shotUrl ? 'd-none' : ''}`}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={onFrameReady}
        aria-label={t('gateInCameraPreview', { document: documentLabel })}
      />
      {shotUrl && <img src={shotUrl} alt={t('gateInPhotoOf', { document: documentLabel })} className="camera-capture-media" />}
      {!frameReady && !shotUrl && <p className="camera-capture-overlay" role="status">{t('gateInCameraStarting')}</p>}
    </div>
  )
}

// Moves focus to `targetRef` whenever `isReady` turns true.
function useFocusWhenReady(targetRef, isReady) {
  useEffect(() => {
    if (isReady) targetRef.current?.focus()
  }, [targetRef, isReady])
}

// Capture, retake and use for one still; "Use photo" is ignored for a short
// moment after Capture (see USE_PHOTO_GUARD_MS).
function useCameraShot({ videoRef, fileName, stop, onCapture }) {
  const [shot, setShot] = useState(null)
  const [captureFailed, setCaptureFailed] = useState(false)
  const shotTakenAtRef = useRef(0)

  const capture = async () => {
    try {
      setShot(await captureVideoFrame(videoRef.current))
      shotTakenAtRef.current = Date.now()
      setCaptureFailed(false)
    } catch {
      setCaptureFailed(true)
    }
  }

  const use = () => {
    if (Date.now() - shotTakenAtRef.current < USE_PHOTO_GUARD_MS) return
    stop()
    onCapture(new File([shot], fileName, { type: CAPTURE_MIME_TYPE }))
  }

  return { shot, captureFailed, capture, retake: () => setShot(null), use }
}

// In-app camera for desktop and https phones: live preview, capture, then
// retake or use. Reports failures (permission denied, no camera) to the
// caller, which falls back to the device file/camera picker.
export default function CameraCaptureDialog({ id, documentLabel, fileName, onCapture, onCameraFailed, onClose }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const captureRef = useRef(null)
  const retakeRef = useRef(null)
  const { status, error, stop } = useCameraStream(videoRef)
  const [frameReady, setFrameReady] = useState(false)
  const { shot, captureFailed, capture, retake, use } = useCameraShot({ videoRef, fileName, stop, onCapture })
  const shotUrl = useObjectUrl(shot)
  useFocusWhenReady(captureRef, frameReady && !shot)
  useFocusWhenReady(retakeRef, Boolean(shot))

  useEffect(() => {
    if (status === CAMERA_STATUS.failed) onCameraFailed(error)
  }, [status, error, onCameraFailed])

  const footer = (
    <CameraFooter shot={shot} frameReady={frameReady} captureRef={captureRef} retakeRef={retakeRef} onCancel={onClose} onCapture={capture} onRetake={retake} onUse={use} />
  )
  return (
    <PassActionDialog id={id} eyebrow={t('gateInCameraTitle')} title={documentLabel} onClose={onClose} footer={footer}>
      <CameraStage videoRef={videoRef} shotUrl={shotUrl} frameReady={frameReady} documentLabel={documentLabel} onFrameReady={() => setFrameReady(true)} />
      {captureFailed && <p className="gate-tile-status gate-tile-status-warn mt-2" role="alert">{t('gateInCameraCaptureFailed')}</p>}
    </PassActionDialog>
  )
}
