// Pass journey values exactly as the API sends them, and how each one is
// shown (pill tone + translation key). Display text is always translated on
// the client from these values; the API's English `display_state` is ignored.

export const PASS_TYPES = {
  inward: 'inward',
  general: 'general',
}

export const PASS_STATES = {
  gateIn: 'GATE_IN',
  onSite: 'ON_SITE',
  qualityPending: 'QUALITY_PENDING',
  qualityResolved: 'QUALITY_RESOLVED',
  grnDraft: 'GRN_DRAFT',
  grnApproved: 'GRN_APPROVED',
  gateOut: 'GATE_OUT',
  cancelled: 'CANCELLED',
}

// Journey order, for state filters and the pass-detail stepper.
export const PASS_STATE_ORDER = Object.values(PASS_STATES)

export const ERP_STATUSES = {
  notRequired: 'not_required',
  pending: 'pending',
  posted: 'posted',
  failed: 'failed',
}

export const QUALITY_RESULTS = {
  approved: 'approved',
  partial: 'partial',
  rejected: 'rejected',
}

const STATE_DISPLAY = {
  [PASS_STATES.onSite]: { tone: 'warn', labelKey: 'stateOnSiteUnloading' },
  [PASS_STATES.qualityPending]: { tone: 'crit', labelKey: 'stateQualityPending' },
  [PASS_STATES.qualityResolved]: { tone: 'good', labelKey: 'stateQualityResolved' },
  [PASS_STATES.grnDraft]: { tone: 'good', labelKey: 'stateGrnDraft' },
  [PASS_STATES.gateOut]: { tone: 'neutral', labelKey: 'stateGateOut' },
  [PASS_STATES.cancelled]: { tone: 'neutral', labelKey: 'stateCancelled' },
}

const ERP_STATUS_DISPLAY = {
  [ERP_STATUSES.posted]: { tone: 'info', labelKey: 'erpPosted' },
  [ERP_STATUSES.pending]: { tone: 'crit', labelKey: 'erpPendingPost' },
  [ERP_STATUSES.failed]: { tone: 'crit', labelKey: 'erpPendingPost' },
  [ERP_STATUSES.notRequired]: { tone: 'warn', labelKey: 'erpNotRequired' },
}

const QUALITY_RESULT_DISPLAY = {
  [QUALITY_RESULTS.approved]: { tone: 'good', labelKey: 'qualityResultApproved' },
  [QUALITY_RESULTS.partial]: { tone: 'warn', labelKey: 'qualityResultPartial' },
  [QUALITY_RESULTS.rejected]: { tone: 'crit', labelKey: 'qualityResultRejected' },
}

const UNKNOWN_DISPLAY = { tone: 'neutral', labelKey: 'stateUnknown' }
const GRN_APPROVED_FALLBACK = { tone: 'info', labelKey: 'stateGrnApproved' }

// GATE_IN means "waiting for the gross weight" for inward material but simply
// "on site" for a general pass; GRN_APPROVED is coloured by the ERP status.
export function passStateDisplay(state, passType, erpStatus) {
  if (state === PASS_STATES.gateIn) {
    return passType === PASS_TYPES.inward
      ? { tone: 'warn', labelKey: 'stateWeighGross' }
      : { tone: 'warn', labelKey: 'stateOnSite' }
  }
  if (state === PASS_STATES.grnApproved) return ERP_STATUS_DISPLAY[erpStatus] ?? GRN_APPROVED_FALLBACK
  return STATE_DISPLAY[state] ?? UNKNOWN_DISPLAY
}

export function erpStatusDisplay(erpStatus) {
  return ERP_STATUS_DISPLAY[erpStatus] ?? UNKNOWN_DISPLAY
}

export function qualityResultDisplay(result) {
  return QUALITY_RESULT_DISPLAY[result] ?? UNKNOWN_DISPLAY
}

// Translation key of a state's name in filter lists, without the
// pass-type / ERP nuance a pill adds.
export function passStateFilterLabelKey(state) {
  if (state === PASS_STATES.gateIn) return 'stateGateIn'
  if (state === PASS_STATES.grnApproved) return 'stateGrnApproved'
  return (STATE_DISPLAY[state] ?? UNKNOWN_DISPLAY).labelKey
}

const CLOSED_STATES = new Set([PASS_STATES.gateOut, PASS_STATES.cancelled])

// Every state a vehicle can be in while it is still on site.
export const OPEN_PASS_STATES = PASS_STATE_ORDER.filter((state) => !CLOSED_STATES.has(state))

export function isPassOpen(pass) {
  return !CLOSED_STATES.has(pass.pass_state)
}

export function isInward(pass) {
  return pass.pass_type === PASS_TYPES.inward
}
