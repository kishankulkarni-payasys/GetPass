import { useLanguage } from '../context/LanguageContext'
import Button from './ui/Button'
import Input from './ui/Input'
import { ConfidenceChip } from './OcrReviewPanel'

const MATERIAL_MAX_LENGTH = 200
const UOM_MAX_LENGTH = 20
const MIN_QUANTITY = 0
const QUANTITY_STEP = 0.001

function LineFields({ line, index, onUpdate }) {
  const { t } = useLanguage()
  const idPrefix = `challan-line-${line.key}`
  const field = (name) => ({
    id: `${idPrefix}-${name}`,
    value: line[name],
    onChange: (event) => onUpdate(line.key, { [name]: event.target.value }),
  })
  return (
    <div className="challan-line-fields">
      <div className="challan-line-material">
        <label className="gate-field-label" htmlFor={`${idPrefix}-material`}>{t('fieldMaterial')}</label>
        <Input {...field('material')} maxLength={MATERIAL_MAX_LENGTH} required className="w-full min-w-0" aria-label={t('challanLineMaterialAria', { line: index + 1 })} />
      </div>
      <div>
        <label className="gate-field-label" htmlFor={`${idPrefix}-quantity`}>{t('fieldQuantity')}</label>
        <Input {...field('quantity')} type="number" inputMode="decimal" min={MIN_QUANTITY} step={QUANTITY_STEP} required className="w-full min-w-0 gp-mono text-right" aria-label={t('challanLineQuantityAria', { line: index + 1 })} />
      </div>
      <div>
        <label className="gate-field-label" htmlFor={`${idPrefix}-uom`}>{t('fieldUom')}</label>
        <Input {...field('uom')} maxLength={UOM_MAX_LENGTH} required className="w-full min-w-0" aria-label={t('challanLineUomAria', { line: index + 1 })} />
      </div>
    </div>
  )
}

function ChallanLine({ line, index, form, canRemove }) {
  const { t } = useLanguage()
  const { actions, isLow, lineNeedsTouch } = form
  const needsTouch = lineNeedsTouch(line)
  return (
    <li className={`challan-line ${needsTouch ? 'challan-line-flag' : ''}`}>
      <div className="challan-line-head">
        <span className="challan-line-number">{t('challanLineNumber', { line: index + 1 })}</span>
        <ConfidenceChip confidence={line.confidence} isLow={isLow(line.confidence)} />
        <span className="flex-1" />
        {needsTouch && (
          <Button size="sm" variant="secondary" onClick={() => actions.confirmLine(line.key)}>
            {t('gateInConfirmValue')}
          </Button>
        )}
        {canRemove && (
          <Button size="sm" variant="ghost" onClick={() => actions.removeLine(line.key)} aria-label={t('challanLineRemoveAria', { line: index + 1 })}>
            {t('challanLineRemove')}
          </Button>
        )}
      </div>
      <LineFields line={line} index={index} onUpdate={actions.updateLine} />
      {needsTouch && <p className="gate-review-hint">{t('gateInLowConfidenceHint')}</p>}
    </li>
  )
}

// Challan lines (1 to max): add, remove, edit; low-confidence OCR lines are
// highlighted and must be confirmed or changed.
export default function ChallanLinesEditor({ form, maxLines }) {
  const { t } = useLanguage()
  const { lines } = form.state
  const atLimit = lines.length >= maxLines
  return (
    <section className="gate-review" aria-labelledby="challan-lines-title">
      <div className="gate-review-head">
        <h3 id="challan-lines-title">{t('challanLinesTitle')}</h3>
        <span className="text-xs">{t('challanLinesCount', { count: lines.length, max: maxLines })}</span>
      </div>
      <ol className="challan-lines">
        {lines.map((line, index) => (
          <ChallanLine key={line.key} line={line} index={index} form={form} canRemove={lines.length > 1} />
        ))}
      </ol>
      <div className="p-3">
        <Button variant="secondary" size="sm" onClick={form.actions.addLine} disabled={atLimit}>
          {t('challanLineAdd')}
        </Button>
        {atLimit && <p className="gate-review-hint mt-2">{t('challanLinesLimit', { max: maxLines })}</p>}
      </div>
    </section>
  )
}
