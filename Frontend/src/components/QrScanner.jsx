import { useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

const SCANNER_ELEMENT_ID = 'qr-scanner-region'

export default function QrScanner({ title = 'Scan QR Code', onScan, onClose }) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  // Chains setup/teardown of the underlying scanner so a new instance never
  // starts until the previous one has fully cleared - React StrictMode runs
  // this effect's setup, cleanup, then setup again in development, and
  // Html5QrcodeScanner's clear() is async, so without this the two
  // instances race and briefly render two overlapping camera views.
  const scannerLifecycleRef = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    let hasScanned = false
    let scanner = null

    scannerLifecycleRef.current = scannerLifecycleRef.current.then(() => {
      if (cancelled) return
      scanner = new Html5QrcodeScanner(
        SCANNER_ELEMENT_ID,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false,
      )
      scanner.render(
        (decodedText) => {
          if (hasScanned) return
          hasScanned = true
          onScanRef.current(decodedText)
        },
        () => {
          // ignore per-frame decode misses while the camera is being aimed
        },
      )
    })

    return () => {
      cancelled = true
      scannerLifecycleRef.current = scannerLifecycleRef.current.then(() => scanner?.clear().catch(() => {}))
    }
  }, [])

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
      <div id={SCANNER_ELEMENT_ID} />
    </div>
  )
}
