import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { OCR_FIELDS } from '../hooks/useInwardPassForm'
import { passDetailPath } from '../navigation/navItems'
import Button from './ui/Button'
import Input from './ui/Input'
import PlateChip from './ui/PlateChip'
import PoCheckBanner from './PoCheckBanner'

const FIELD_MAX_LENGTHS = {
  [OCR_FIELDS.vehicleNumber]: 20,
  [OCR_FIELDS.poNumber]: 50,
  [OCR_FIELDS.supplier]: 100,
  [OCR_FIELDS.challanNumber]: 50,
}

const FIELD_LABEL_KEYS = {
  [OCR_FIELDS.vehicleNumber]: 'fieldVehicleNumber',
  [OCR_FIELDS.poNumber]: 'fieldPoNumber',
  [OCR_FIELDS.supplier]: 'fieldSupplier',
  [OCR_FIELDS.challanNumber]: 'fieldChallanNumber',
}

const REQUIRED_FIELDS = new Set([OCR_FIELDS.vehicleNumber, OCR_FIELDS.poNumber, OCR_FIELDS.challanNumber])
const MONO_FIELDS = new Set([OCR_FIELDS.vehicleNumber, OCR_FIELDS.poNumber, OCR_FIELDS.challanNumber])

// "OCR 92%" chip: green at or above the threshold, amber below it.
export function ConfidenceChip({ confidence, isLow }) {
  const { t } = useLanguage()
  if (confidence === null || confidence === undefined) return null
  const percent = Math.round(confidence)
  return (
    <span className={`gp-conf ${isLow ? 'gp-conf-lo' : 'gp-conf-hi'}`} title={t('gateInConfidenceTitle', { percent })}>
      {percent}%
    </span>
  )
}

function ReviewField({ name, field, isLow, needsTouch, onChange, onConfirm, children }) {
  const { t } = useLanguage()
  const id = `gate-in-${name}`
  const hintId = `${id}-hint`
  return (
    <div className={`gate-review-field ${needsTouch ? 'gate-review-field-flag' : ''}`}>
      <label className="gate-field-label" htmlFor={id}>
        {t(FIELD_LABEL_KEYS[name])}
        {REQUIRED_FIELDS.has(name) && <span aria-hidden="true"> *</span>}
      </label>
      <div className="gate-review-input">
        <Input
          id={id}
          value={field.value}
          onChange={(event) => onChange(name, event.target.value)}
          maxLength={FIELD_MAX_LENGTHS[name]}
          required={REQUIRED_FIELDS.has(name)}
          aria-describedby={needsTouch ? hintId : undefined}
          className={`w-full min-w-0 ${MONO_FIELDS.has(name) ? 'gp-mono' : ''}`}
          autoComplete="off"
        />
        <ConfidenceChip confidence={field.confidence} isLow={isLow} />
        {needsTouch && (
          <Button size="sm" variant="secondary" onClick={() => onConfirm(name)}>
            {t('gateInConfirmValue')}
          </Button>
        )}
      </div>
      {needsTouch && <p id={hintId} className="gate-review-hint">{t('gateInLowConfidenceHint')}</p>}
      {children}
    </div>
  )
}

function OpenPassWarning({ openPass }) {
  const { t } = useLanguage()
  if (!openPass) return null
  return (
    <div className="gp-banner gp-banner-warn mt-2" role="status">
      {t('gateInOpenPassWarning')}{' '}
      <Link to={passDetailPath(openPass.id)} className="gp-link">{t('gateInOpenPassLink')}</Link>
    </div>
  )
}

// Review of the header fields: what OCR read (with confidence), editable.
// A low-confidence value is highlighted and must be confirmed or changed.
export default function OcrReviewPanel({ form, poCheck, openPass, onPickPo }) {
  const { t } = useLanguage()
  const { state, actions, isLow, fieldNeedsTouch } = form
  const fieldProps = (name) => ({
    name,
    field: state.fields[name],
    isLow: isLow(state.fields[name].confidence),
    needsTouch: fieldNeedsTouch(name),
    onChange: actions.setField,
    onConfirm: actions.confirmField,
  })
  const plate = state.fields[OCR_FIELDS.vehicleNumber].value

  return (
    <section className="gate-review" aria-labelledby="gate-review-title">
      <div className="gate-review-head">
        <h3 id="gate-review-title">{t('gateInReviewTitle')}</h3>
        {plate.trim() && <PlateChip number={plate} size="md" />}
      </div>
      <ReviewField {...fieldProps(OCR_FIELDS.vehicleNumber)}>
        <OpenPassWarning openPass={openPass} />
      </ReviewField>
      <ReviewField {...fieldProps(OCR_FIELDS.poNumber)}>
        <div className="mt-2">
          <PoCheckBanner check={poCheck} onPickPo={onPickPo} />
        </div>
      </ReviewField>
      <ReviewField {...fieldProps(OCR_FIELDS.supplier)} />
      <ReviewField {...fieldProps(OCR_FIELDS.challanNumber)} />
    </section>
  )
}
