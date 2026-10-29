import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Button from './ui/Button'

// Live camera (back camera on phones). The caller uploads the blob with its photo kind.
export default function PhotoCapture({ title, onCapture, onClose }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {
        onClose()
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob)
    }, 'image/jpeg')
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title ?? t('weighbridgeCapturePhoto')}</h3>
        <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
          {t('cancel')}
        </button>
      </div>
      <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
      <Button type="button" onClick={handleCapture} className="mt-3 w-full">
        {t('weighbridgeCapture')}
      </Button>
    </div>
  )
}
