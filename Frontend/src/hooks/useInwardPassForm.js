import { useCallback, useMemo, useReducer } from 'react'
import { OCR_DOC_TYPES } from '../api/gateIn'
import { normalizePlate } from '../utils/plate'

// Header fields that OCR can fill. Each keeps the OCR value and confidence
// next to what the guard finally typed, so overrides can be reported (B2).
export const OCR_FIELDS = {
  vehicleNumber: 'vehicle_number',
  poNumber: 'po_number',
  supplier: 'supplier_transporter_name',
  challanNumber: 'challan_number',
}

export const GATE_IN_METHODS = { ocr: 'ocr', qr: 'qr', manual: 'manual' }

const EMPTY_FIELD = { value: '', ocrValue: null, confidence: null, confirmed: false }
let nextLineKey = 0

function newLine(values = {}) {
  nextLineKey += 1
  const line = { key: `line-${nextLineKey}`, material: '', quantity: '', uom: '', confidence: null, ocrValue: null, confirmed: false, ...values }
  return line
}

function lineSnapshot({ material, quantity, uom }) {
  return `${String(material).trim()} | ${String(quantity).trim()} | ${String(uom).trim()}`
}

function ocrLine({ material, quantity, uom, confidence }) {
  const values = { material: material ?? '', quantity: quantity ?? '', uom: uom ?? '', confidence: confidence ?? null }
  return newLine({ ...values, ocrValue: lineSnapshot(values) })
}

const initialState = () => ({
  fields: Object.fromEntries(Object.values(OCR_FIELDS).map((name) => [name, EMPTY_FIELD])),
  lines: [newLine()],
  driverName: '',
  driverPhone: '',
  usedOcr: false,
  usedQr: false,
})

function ocrField(value, confidence) {
  const text = value == null ? '' : String(value)
  return { value: text, ocrValue: text, confidence: confidence ?? null, confirmed: false }
}

function applyOcrResult(state, { docType, result }) {
  const fields = { ...state.fields }
  const fieldConfidence = result.field_confidence ?? {}
  const confidenceOf = (key) => fieldConfidence[key] ?? result.confidence
  if (docType === OCR_DOC_TYPES.plate && result.plate) {
    fields[OCR_FIELDS.vehicleNumber] = ocrField(result.plate, result.confidence)
  }
  if (docType === OCR_DOC_TYPES.po) {
    if (result.po_number) fields[OCR_FIELDS.poNumber] = ocrField(result.po_number, confidenceOf('po_number'))
    if (result.supplier_name) fields[OCR_FIELDS.supplier] = ocrField(result.supplier_name, confidenceOf('supplier_name'))
  }
  let { lines } = state
  if (docType === OCR_DOC_TYPES.challan) {
    if (result.challan_number) fields[OCR_FIELDS.challanNumber] = ocrField(result.challan_number, confidenceOf('challan_number'))
    // OCR that found no lines leaves the guard's own lines alone.
    if (result.lines?.length) lines = result.lines.map(ocrLine)
  }
  return { ...state, fields, lines, usedOcr: true }
}

// QR codes only pre-fill empty or editable fields; they carry no confidence.
function applyQrValues(state, values) {
  const fields = { ...state.fields }
  Object.entries(values).forEach(([name, value]) => {
    if (name in fields && value) fields[name] = { ...EMPTY_FIELD, value: String(value) }
  })
  return {
    ...state,
    fields,
    driverName: values.driver_name ? String(values.driver_name) : state.driverName,
    driverPhone: values.driver_phone ? String(values.driver_phone) : state.driverPhone,
    usedQr: true,
  }
}

const HANDLERS = {
  setField: (state, { name, value }) => ({ ...state, fields: { ...state.fields, [name]: { ...state.fields[name], value } } }),
  confirmField: (state, { name }) => ({ ...state, fields: { ...state.fields, [name]: { ...state.fields[name], confirmed: true } } }),
  applyOcr: applyOcrResult,
  applyQr: (state, { values }) => applyQrValues(state, values),
  setDriver: (state, { driverName = state.driverName, driverPhone = state.driverPhone }) => ({ ...state, driverName, driverPhone }),
  addLine: (state) => ({ ...state, lines: [...state.lines, newLine()] }),
  updateLine: (state, { key, patch }) => ({ ...state, lines: state.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)) }),
  removeLine: (state, { key }) => ({ ...state, lines: state.lines.filter((line) => line.key !== key) }),
  reset: () => initialState(),
}

function reducer(state, action) {
  const handler = HANDLERS[action.type]
  return handler ? handler(state, action) : state
}

function isLowConfidence(confidence, threshold) {
  return confidence !== null && confidence !== undefined && confidence < threshold
}

// A low-confidence value must be touched: confirmed, or changed by the guard.
function fieldNeedsConfirm(field, threshold) {
  return isLowConfidence(field.confidence, threshold) && !field.confirmed && field.value === field.ocrValue
}

function lineNeedsConfirm(line, threshold) {
  return isLowConfidence(line.confidence, threshold) && !line.confirmed && lineSnapshot(line) === line.ocrValue
}

function isLineComplete({ material, quantity, uom }) {
  const amount = Number(quantity)
  return material.trim() !== '' && uom.trim() !== '' && quantity !== '' && Number.isFinite(amount) && amount >= 0
}

function fieldOverrides(fields, threshold) {
  return Object.entries(fields)
    .filter(([, field]) => field.ocrValue !== null)
    .filter(([, field]) => field.value.trim() !== field.ocrValue || isLowConfidence(field.confidence, threshold))
    .map(([name, field]) => ({ field: name, ocr_value: field.ocrValue, final_value: field.value.trim(), confidence: field.confidence }))
}

function lineOverrides(lines, threshold) {
  return lines
    .map((line, index) => ({ line, field: `challan_line_${index + 1}` }))
    .filter(({ line }) => line.ocrValue !== null)
    .filter(({ line }) => lineSnapshot(line) !== line.ocrValue || isLowConfidence(line.confidence, threshold))
    .map(({ line, field }) => ({ field, ocr_value: line.ocrValue, final_value: lineSnapshot(line), confidence: line.confidence }))
}

function gateInMethod({ usedOcr, usedQr }) {
  if (usedOcr) return GATE_IN_METHODS.ocr
  return usedQr ? GATE_IN_METHODS.qr : GATE_IN_METHODS.manual
}

function buildPayload(state, threshold, clientRef) {
  const { fields } = state
  const valueOf = (name) => fields[name].value.trim()
  return {
    pass_type: 'inward',
    client_ref: clientRef,
    gate_in_method: gateInMethod(state),
    vehicle_number: normalizePlate(valueOf(OCR_FIELDS.vehicleNumber)),
    driver_name: state.driverName.trim(),
    driver_phone: state.driverPhone.trim(),
    po_number: valueOf(OCR_FIELDS.poNumber),
    challan_number: valueOf(OCR_FIELDS.challanNumber),
    supplier_transporter_name: valueOf(OCR_FIELDS.supplier),
    challan_lines: state.lines.map(({ material, quantity, uom, confidence }) => ({
      material: material.trim(),
      quantity: Number(quantity),
      uom: uom.trim(),
      ocr_confidence: confidence,
    })),
    ocr: {
      anpr_confidence: fields[OCR_FIELDS.vehicleNumber].confidence,
      po_confidence: fields[OCR_FIELDS.poNumber].confidence,
      challan_confidence: fields[OCR_FIELDS.challanNumber].confidence,
      overridden_fields: [...fieldOverrides(fields, threshold), ...lineOverrides(state.lines, threshold)],
    },
  }
}

// State and rules of the inward gate-in form (B1, B2).
export function useInwardPassForm({ threshold, maxLines }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const actions = useMemo(
    () => ({
      setField: (name, value) => dispatch({ type: 'setField', name, value }),
      confirmField: (name) => dispatch({ type: 'confirmField', name }),
      applyOcr: (docType, result) => dispatch({ type: 'applyOcr', docType, result }),
      applyQr: (values) => dispatch({ type: 'applyQr', values }),
      setDriver: (patch) => dispatch({ type: 'setDriver', ...patch }),
      addLine: () => dispatch({ type: 'addLine' }),
      updateLine: (key, patch) => dispatch({ type: 'updateLine', key, patch }),
      confirmLine: (key) => dispatch({ type: 'updateLine', key, patch: { confirmed: true } }),
      removeLine: (key) => dispatch({ type: 'removeLine', key }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  )

  const unconfirmedCount =
    Object.values(state.fields).filter((field) => fieldNeedsConfirm(field, threshold)).length +
    state.lines.filter((line) => lineNeedsConfirm(line, threshold)).length

  const requiredFilled =
    [OCR_FIELDS.vehicleNumber, OCR_FIELDS.poNumber, OCR_FIELDS.challanNumber].every((name) => state.fields[name].value.trim() !== '') &&
    state.driverName.trim() !== ''
  const linesValid = state.lines.length > 0 && state.lines.length <= maxLines && state.lines.every(isLineComplete)

  const isLow = useCallback((confidence) => isLowConfidence(confidence, threshold), [threshold])
  const fieldNeedsTouch = (name) => fieldNeedsConfirm(state.fields[name], threshold)
  const lineNeedsTouch = (line) => lineNeedsConfirm(line, threshold)

  return {
    state,
    actions,
    isLow,
    fieldNeedsTouch,
    lineNeedsTouch,
    unconfirmedCount,
    canSubmit: requiredFilled && linesValid && unconfirmedCount === 0,
    missingRequired: !requiredFilled || !linesValid,
    buildPayload: (clientRef) => buildPayload(state, threshold, clientRef),
  }
}
