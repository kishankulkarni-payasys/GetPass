import { useCallback, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { CAMERA_ERROR, isCameraPermissionBlocked, isCameraSupported } from '../hooks/useCameraStream'
import CameraCaptureDialog from './CameraCaptureDialog'

const NOTICE_KEYS = {
  [CAMERA_ERROR.denied]: 'gateInCameraDenied',
  [CAMERA_ERROR.noCamera]: 'gateInCameraNoCamera',
  [CAMERA_ERROR.unavailable]: 'gateInCameraUnavailable',
}

// Shown by the tile below both action buttons, so "Choose file" stays beside "Take photo".
export function CameraErrorNotice({ error }) {
  const { t } = useLanguage()
  if (!error) return null
  return <p className="gate-tile-status gate-tile-status-warn gate-tile-notice" role="status">{t(NOTICE_KEYS[error])}</p>
}

// A missing camera will not appear within the visit. A denial is re-checked on
// each tap because a dismissed prompt is reported the same way as a block.
async function shouldSkipCamera(lastError) {
  if (lastError === CAMERA_ERROR.noCamera) return true
  if (lastError === CAMERA_ERROR.denied) return isCameraPermissionBlocked()
  return false
}

// Open/close state of the in-app camera plus the picker fallback it reports to.
function useTakePhotoFlow({ cameraError, onCameraError, onFile }) {
  const fallbackInputRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const openPicker = () => fallbackInputRef.current?.click()

  const openCameraOrPicker = async () => {
    if (await shouldSkipCamera(cameraError)) return openPicker()
    onCameraError(null)
    return setCameraOpen(true)
  }

  const handleCameraFailed = useCallback((error) => {
    setCameraOpen(false)
    onCameraError(error)
    // Browsers may block this click if the permission prompt took long; the
    // notice then tells the user to use "Choose file" instead.
    fallbackInputRef.current?.click()
  }, [onCameraError])

  const handleCapture = (file) => {
    setCameraOpen(false)
    onFile(file)
  }

  const closeCamera = useCallback(() => setCameraOpen(false), [])
  return { fallbackInputRef, cameraOpen, openPicker, openCameraOrPicker, handleCameraFailed, handleCapture, closeCamera }
}

// "Take photo": in-app camera where getUserMedia exists (desktop webcams,
// https phones); otherwise the device picker with capture="environment",
// which opens the phone camera app on plain-http LAN where getUserMedia is absent.
// While disabled it stays focusable (aria-disabled) so a dialog closing onto it
// can still return focus here.
export default function TakePhotoButton({ kind, documentLabel, disabled, cameraError, onCameraError, onFile, onInputChange }) {
  const { t } = useLanguage()
  const flow = useTakePhotoFlow({ cameraError, onCameraError, onFile })

  const handleClick = () => {
    if (disabled) return
    // Kept synchronous so the picker opens inside the user's tap.
    if (!isCameraSupported()) return flow.openPicker()
    return flow.openCameraOrPicker()
  }

  return (
    <>
      <button
        type="button"
        className={`gp-btn gp-btn-primary gp-btn-sm ${disabled ? 'gate-tile-input-disabled' : ''}`}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        aria-label={t('gateInTakePhotoOf', { document: documentLabel })}
      >
        {t('gateInTakePhoto')}
      </button>
      {/* Fallback only: opened by the button above, so it is kept out of the tab order. */}
      <input ref={flow.fallbackInputRef} type="file" accept="image/*" capture="environment" className="visually-hidden" tabIndex={-1} aria-hidden="true" disabled={disabled} onChange={onInputChange} />
      {flow.cameraOpen && (
        <CameraCaptureDialog
          id={`camera-${kind}`}
          documentLabel={documentLabel}
          fileName={`${kind}.jpg`}
          onCapture={flow.handleCapture}
          onCameraFailed={flow.handleCameraFailed}
          onClose={flow.closeCamera}
        />
      )}
    </>
  )
}
