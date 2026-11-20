import { useCallback, useEffect, useRef, useState } from 'react'

// Full HD is enough for OCR on plates and A4 documents without heavy uploads.
const IDEAL_WIDTH = 1920
const IDEAL_HEIGHT = 1080

const PREFERRED_CONSTRAINTS = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: IDEAL_WIDTH }, height: { ideal: IDEAL_HEIGHT } },
}
const ANY_CAMERA_CONSTRAINTS = { audio: false, video: true }

export const CAMERA_STATUS = { starting: 'starting', live: 'live', failed: 'failed' }
export const CAMERA_ERROR = { denied: 'denied', noCamera: 'noCamera', unavailable: 'unavailable' }

const DENIED_ERRORS = new Set(['NotAllowedError', 'PermissionDeniedError', 'SecurityError'])
const NO_CAMERA_ERRORS = new Set(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'])

// getUserMedia exists only in secure contexts (https or localhost), so a phone
// opening the app over plain-http LAN gets false here.
export function isCameraSupported() {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia)
}

function classifyCameraError(error) {
  if (DENIED_ERRORS.has(error?.name)) return CAMERA_ERROR.denied
  if (NO_CAMERA_ERRORS.has(error?.name)) return CAMERA_ERROR.noCamera
  return CAMERA_ERROR.unavailable
}

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop())
}

// Some older browsers reject the size/facing hints outright; retry with any camera.
async function openCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia(PREFERRED_CONSTRAINTS)
  } catch (error) {
    if (error?.name !== 'OverconstrainedError') throw error
    return navigator.mediaDevices.getUserMedia(ANY_CAMERA_CONSTRAINTS)
  }
}

// Denied is only lasting when the browser says so: Chrome also reports a
// dismissed prompt as NotAllowedError, and that user may simply try again.
export async function isCameraPermissionBlocked() {
  try {
    const permission = await navigator.permissions?.query({ name: 'camera' })
    return permission?.state === 'denied'
  } catch {
    // Firefox and Safari may not know the 'camera' name; let getUserMedia decide.
    return false
  }
}

// Opens the stream and hands it to `onLive`, or the classified error to
// `onFailed`; a stream that arrives after `isCancelled()` is stopped at once.
async function startCameraStream({ isCancelled, onLive, onFailed }) {
  try {
    const stream = await openCameraStream()
    if (isCancelled()) return stopTracks(stream)
    return onLive(stream)
  } catch (err) {
    if (!isCancelled()) onFailed(classifyCameraError(err))
    return undefined
  }
}

// Opens the camera into `videoRef` on mount and always stops every track on
// unmount (or via `stop`) so the camera light turns off.
export default function useCameraStream(videoRef) {
  const streamRef = useRef(null)
  const [status, setStatus] = useState(CAMERA_STATUS.starting)
  const [error, setError] = useState(null)

  const stop = useCallback(() => {
    stopTracks(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [videoRef])

  useEffect(() => {
    let cancelled = false
    const onLive = (stream) => {
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setStatus(CAMERA_STATUS.live)
    }
    const onFailed = (cameraError) => {
      setError(cameraError)
      setStatus(CAMERA_STATUS.failed)
    }
    startCameraStream({ isCancelled: () => cancelled, onLive, onFailed })
    return () => {
      cancelled = true
      stop()
    }
  }, [videoRef, stop])

  return { status, error, stop }
}
