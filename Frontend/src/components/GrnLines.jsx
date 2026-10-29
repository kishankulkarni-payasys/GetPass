import { GRN_LINE_FLAGS } from '../api/grn'
import { useLanguage } from '../context/LanguageContext'
import Badge from './ui/Badge'

export const QTY_FIELDS = ['received_qty', 'accepted_qty', 'rejected_qty']

const QTY_LABEL_KEYS = {
  received_qty: 'grnColReceived',
  accepted_qty: 'grnColAccepted',
  rejected_qty: 'grnColRejected',
}

const FLAG_LABEL_KEYS = {
  [GRN_LINE_FLAGS.receivedVsChallan]: 'grnFlagReceivedVsChallan',
  [GRN_LINE_FLAGS.splitVsReceived]: 'grnFlagSplitVsReceived',
  [GRN_LINE_FLAGS.receivedVsPo]: 'grnFlagReceivedVsPo',
  [GRN_LINE_FLAGS.acceptedVsQuality]: 'grnFlagAcceptedVsQuality',
}

const QTY_FORMAT = { maximumFractionDigits: 3 }
const NUMBER_LOCALE = 'en-IN'
const MIN_QTY = 0
const QTY_STEP = 0.001

export function formatQty(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString(NUMBER_LOCALE, QTY_FORMAT)
}

// Informational only (B7): shown as amber chips, never blocking.
function LineFlags({ flags }) {
  const { t } = useLanguage()
  if (!flags?.length) return null
  return (
    <div className="grn-flags">
      {flags.map((flag) => (
        <Badge key={flag} tone="warn">{t(FLAG_LABEL_KEYS[flag] ?? 'grnFlagOther')}</Badge>
      ))}
    </div>
  )
}

function QtyInput({ line, field, value, onChange, editable }) {
  const { t } = useLanguage()
  if (!editable) return <span className="gp-mono">{formatQty(line[field])}</span>
  const edited = String(value) !== String(line[field])
  return (
    <input
      type="number"
      inputMode="decimal"
      min={MIN_QTY}
      step={QTY_STEP}
      value={value}
      onChange={(event) => onChange(line.id, field, event.target.value)}
      className={`grn-qty-input gp-mono ${edited ? 'grn-qty-input-edited' : ''}`}
      aria-label={t('grnQtyAria', { field: t(QTY_LABEL_KEYS[field]), material: line.material })}
    />
  )
}

function ReceivedHint() {
  const { t } = useLanguage()
  // "<- challan": the received quantity starts as the challan quantity.
  return <span className="grn-src-hint">{t('grnFromChallan')}</span>
}

function LinesTable({ lines, values, onChange, editable }) {
  const { t } = useLanguage()
  return (
    <div className="grn-table-wrap d-none d-lg-block">
      <table className="grn-table">
        <thead>
          <tr>
            <th scope="col">{t('fieldMaterial')}</th>
            <th scope="col" className="num">{t('grnColPoQty')}</th>
            <th scope="col" className="num">{t('grnColChallanQty')}</th>
            {QTY_FIELDS.map((field) => <th key={field} scope="col" className="num">{t(QTY_LABEL_KEYS[field])}</th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <span className="font-semibold">{line.material}</span> <span className="text-xs">({line.uom})</span>
                <LineFlags flags={line.flags} />
              </td>
              <td className="num gp-mono">{formatQty(line.po_qty)}</td>
              <td className="num gp-mono">{formatQty(line.challan_qty)}</td>
              {QTY_FIELDS.map((field) => (
                <td key={field} className="num">
                  <QtyInput line={line} field={field} value={values[line.id]?.[field] ?? line[field]} onChange={onChange} editable={editable} />
                  {field === 'received_qty' && editable && <ReceivedHint />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LineCard({ line, values, onChange, editable }) {
  const { t } = useLanguage()
  return (
    <li className="grn-line-card">
      <p className="m-0 font-bold">{line.material} <span className="text-xs font-normal">({line.uom})</span></p>
      <dl className="grn-line-facts">
        <div><dt>{t('grnColPoQty')}</dt><dd className="gp-mono">{formatQty(line.po_qty)}</dd></div>
        <div><dt>{t('grnColChallanQty')}</dt><dd className="gp-mono">{formatQty(line.challan_qty)}</dd></div>
      </dl>
      <div className="grn-line-inputs">
        {QTY_FIELDS.map((field) => (
          <div key={field}>
            <span className="gate-field-label">{t(QTY_LABEL_KEYS[field])}</span>
            <QtyInput line={line} field={field} value={values[line.id]?.[field] ?? line[field]} onChange={onChange} editable={editable} />
          </div>
        ))}
      </div>
      <LineFlags flags={line.flags} />
    </li>
  )
}

// GRN lines: table on desktop, cards below lg. Quantities are freely editable in a draft (B6).
export default function GrnLines({ lines, values, onChange, editable }) {
  return (
    <>
      <LinesTable lines={lines} values={values} onChange={onChange} editable={editable} />
      <ul className="grn-line-cards d-lg-none">
        {lines.map((line) => (
          <LineCard key={line.id} line={line} values={values} onChange={onChange} editable={editable} />
        ))}
      </ul>
    </>
  )
}
