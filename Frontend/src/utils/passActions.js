// The next steps a role may take on a pass, as links to the section that does
// them. Mirrors spec 5.2; the API still enforces every rule.
import { ENTRY_SECTIONS, PAGE_SECTIONS, ROUTES, canOpenSection, returnPassPath } from '../navigation/navItems'
import { PASS_STATES, isInward } from './passStates'
import { canCaptureGross, canCaptureTare, needsGross } from './weighRules'

const QUALITY_STATES = new Set([PASS_STATES.qualityPending, PASS_STATES.qualityResolved])
const GRN_EDITOR_STATES = new Set([PASS_STATES.qualityResolved, PASS_STATES.grnDraft, PASS_STATES.grnApproved])

function canExit(pass) {
  if (isInward(pass)) return pass.pass_state === PASS_STATES.grnApproved
  return pass.pass_state === PASS_STATES.gateIn
}

function weighAction(pass, role) {
  if (!canOpenSection(role, ENTRY_SECTIONS.weighbridge)) return null
  if (!canCaptureGross(pass) && !canCaptureTare(pass)) return null
  return { id: 'weigh', to: `${ROUTES.weighbridge}?entry=${pass.id}`, labelKey: 'passActionWeigh', primary: needsGross(pass) }
}

function storeAction(pass, role) {
  if (!canOpenSection(role, ENTRY_SECTIONS.grn) || !isInward(pass)) return null
  if (pass.pass_state === PASS_STATES.onSite) return { id: 'send', to: ROUTES.grn, labelKey: 'passActionSendToQuality', primary: true }
  if (GRN_EDITOR_STATES.has(pass.pass_state)) return { id: 'grn', to: `${ROUTES.grn}?pass=${pass.id}`, labelKey: 'passActionGrn', primary: true }
  return null
}

function qualityAction(pass, role) {
  if (!canOpenSection(role, ENTRY_SECTIONS.quality) || !QUALITY_STATES.has(pass.pass_state)) return null
  return { id: 'quality', to: ROUTES.quality, labelKey: 'passActionQuality', primary: pass.pass_state === PASS_STATES.qualityPending }
}

function gateOutAction(pass, role) {
  if (!canOpenSection(role, ENTRY_SECTIONS.gateOut) || !canExit(pass)) return null
  return { id: 'gateOut', to: ROUTES.gateOut, labelKey: 'passActionGateOut', primary: true }
}

function returnPassAction(pass, role) {
  if (!pass.grn?.return_pass_number || !canOpenSection(role, PAGE_SECTIONS.returnPass)) return null
  return { id: 'returnPass', to: returnPassPath(pass.id), labelKey: 'passActionReturnPass', primary: false }
}

export function passActionsFor(pass, role) {
  return [weighAction, storeAction, qualityAction, gateOutAction, returnPassAction]
    .map((build) => build(pass, role))
    .filter(Boolean)
}
