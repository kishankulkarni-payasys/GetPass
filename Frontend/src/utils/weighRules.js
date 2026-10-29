// Client copy of the weighing rules in spec 5.2, used to enable buttons.
// The API enforces the same rules and answers 409 otherwise.
import { PASS_STATES, isInward, isPassOpen } from './passStates'

export const WEIGHMENT_KINDS = { gross: 'gross', tare: 'tare' }
export const WEIGHMENT_SOURCES = { indicator: 'indicator', manual: 'manual', legacy: 'legacy' }

// Re-capturing gross (with a reason) is allowed until the GRN is approved.
const INWARD_GROSS_RECAPTURE_STATES = new Set([
  PASS_STATES.onSite,
  PASS_STATES.qualityPending,
  PASS_STATES.qualityResolved,
  PASS_STATES.grnDraft,
])

const INWARD_TARE_STATES = new Set([...INWARD_GROSS_RECAPTURE_STATES, PASS_STATES.grnApproved])

export function hasGross(pass) {
  return pass.gross_weight !== null && pass.gross_weight !== undefined
}

// The first weighing an inward pass waits for at the weighbridge.
export function needsGross(pass) {
  return isPassOpen(pass) && !hasGross(pass) && (!isInward(pass) || pass.pass_state === PASS_STATES.gateIn)
}

export function canCaptureGross(pass) {
  if (!isInward(pass)) return pass.pass_state === PASS_STATES.gateIn
  return pass.pass_state === PASS_STATES.gateIn || INWARD_GROSS_RECAPTURE_STATES.has(pass.pass_state)
}

export function canCaptureTare(pass) {
  if (!isInward(pass)) return pass.pass_state === PASS_STATES.gateIn
  return INWARD_TARE_STATES.has(pass.pass_state)
}

// The current (not superseded) row of a kind, or null.
export function currentWeighment(weighments, kind) {
  return weighments.find((row) => row.kind === kind && !row.is_superseded) ?? null
}

const KG_PER_TON = 1000

export function weightInKg(weight, unit) {
  return unit === 'ton' ? weight * KG_PER_TON : weight
}
