import { useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

const SCANNER_ELEMENT_ID = 'qr-scanner-region'

export default function QrScanner({ onScan, onClose }) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      SCANNER_ELEMENT_ID,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false,
    )

    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => {})
        onScanRef.current(decodedText)
      },
      () => {
        // ignore per-frame decode misses while the camera is being aimed
      },
    )

    return () => {
      scanner.clear().catch(() => {})
    }
  }, [])

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Scan Document QR Code</h3>
        <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
      <div id={SCANNER_ELEMENT_ID} />
    </div>
  )
}
