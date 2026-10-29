import { useEffect, useState } from 'react'
import { OCR_DOC_TYPES, readDocument } from '../api/gateIn'
import { useLanguage } from '../context/LanguageContext'
import { apiErrorDetail, translateApiDetail } from '../i18n/apiErrors'

// Photo kinds stored with the pass, and the OCR document type each one reads.
export const CAPTURE_TILES = [
  { kind: 'plate', docType: OCR_DOC_TYPES.plate, labelKey: 'gateInTilePlate', hintKey: 'gateInTilePlateHint' },
  { kind: 'po_doc', docType: OCR_DOC_TYPES.po, labelKey: 'gateInTilePo', hintKey: 'gateInTilePoHint' },
  { kind: 'challan_doc', docType: OCR_DOC_TYPES.challan, labelKey: 'gateInTileChallan', hintKey: 'gateInTileChallanHint' },
]

const READ_STATUS = { idle: 'idle', reading: 'reading', read: 'read', failed: 'failed' }

function usePreviewUrl(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url
}

function TileStatus({ status, confidence, errorDetail, ocrActive }) {
  const { t } = useLanguage()
  if (status === READ_STATUS.reading) return <p className="gate-tile-status" role="status">{t('gateInOcrReading')}</p>
  if (status === READ_STATUS.read) {
    return (
      <p className="gate-tile-status gate-tile-status-good" role="status">
        {t('gateInOcrRead')}
        {confidence != null && <span className="gp-mono"> · {Math.round(confidence)}%</span>}
      </p>
    )
  }
  if (status === READ_STATUS.failed) {
    return <p className="gate-tile-status gate-tile-status-warn" role="status">{translateApiDetail(errorDetail, t, 'gateInOcrFailed')}</p>
  }
  return <p className="gate-tile-status">{ocrActive ? t('gateInOcrWillRead') : t('gateInOcrOffNote')}</p>
}

function TileInputs({ tile, disabled, onFile }) {
  const { t } = useLanguage()
  const handleChange = (event) => {
    const [file] = event.target.files ?? []
    // Reset so taking the same photo again still fires onChange.
    event.target.value = ''
    if (file) onFile(file)
  }
  const label = t(tile.labelKey)
  return (
    <div className="gate-tile-actions">
      <label className={`gp-btn gp-btn-primary gp-btn-sm ${disabled ? 'gate-tile-input-disabled' : ''}`}>
        {t('gateInTakePhoto')}
        <input type="file" accept="image/*" capture="environment" className="visually-hidden" disabled={disabled} onChange={handleChange} aria-label={t('gateInTakePhotoOf', { document: label })} />
      </label>
      <label className={`gp-btn gp-btn-secondary gp-btn-sm ${disabled ? 'gate-tile-input-disabled' : ''}`}>
        {t('gateInChooseFile')}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={disabled} onChange={handleChange} aria-label={t('gateInChooseFileOf', { document: label })} />
      </label>
    </div>
  )
}

function CaptureTile({ tile, file, ocrActive, disabled, onPhoto, onOcrResult }) {
  const { t } = useLanguage()
  const previewUrl = usePreviewUrl(file)
  const [status, setStatus] = useState(READ_STATUS.idle)
  const [confidence, setConfidence] = useState(null)
  const [errorDetail, setErrorDetail] = useState(null)

  const handleFile = async (selected) => {
    onPhoto(tile.kind, selected)
    if (!ocrActive) return
    setStatus(READ_STATUS.reading)
    try {
      const result = await readDocument(selected, tile.docType)
      setConfidence(result.confidence ?? null)
      setStatus(READ_STATUS.read)
      onOcrResult(tile.docType, result)
    } catch (err) {
      setErrorDetail(apiErrorDetail(err))
      setStatus(READ_STATUS.failed)
    }
  }

  const label = t(tile.labelKey)
  return (
    <div className="gate-tile">
      <div className="gate-tile-frame">
        <span className="gate-tile-caption">{label}</span>
        {previewUrl ? (
          <img src={previewUrl} alt={t('gateInPhotoOf', { document: label })} className="gate-tile-image" />
        ) : (
          <span className="gate-tile-empty">{t(tile.hintKey)}</span>
        )}
      </div>
      <TileStatus status={status} confidence={confidence} errorDetail={errorDetail} ocrActive={ocrActive} />
      <TileInputs tile={tile} disabled={disabled || status === READ_STATUS.reading} onFile={handleFile} />
    </div>
  )
}

// Three capture tiles: number plate, PO document, challan. Each photo is kept
// for upload with its kind; with OCR on (and online) it is also read at once.
export default function GateInCaptureTiles({ photos, ocrActive, disabled, onPhoto, onOcrResult, resetKey }) {
  return (
    <div className="gate-tiles">
      {CAPTURE_TILES.map((tile) => (
        <CaptureTile
          key={`${tile.kind}-${resetKey}`}
          tile={tile}
          file={photos[tile.kind]}
          ocrActive={ocrActive}
          disabled={disabled}
          onPhoto={onPhoto}
          onOcrResult={onOcrResult}
        />
      ))}
    </div>
  )
}
