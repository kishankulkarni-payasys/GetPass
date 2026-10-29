// The backend answers in English only. Known `detail` strings are mapped to
// translation keys (texts live in strings/common.js); anything else, mainly
// 422 validation text, is shown unchanged so the reason is never hidden.
//
// Keep in sync with the backend: these must match the HTTPException `detail`
// strings in Backend/app/auth.py and Backend/app/routers/*.py word for word.
// If a backend message is reworded, the lookup misses and English shows - a
// safe failure, but update this table when that happens.
const KEY_BY_API_DETAIL = {
  'Invalid username or password': 'apiErrorInvalidCredentials',
  'Not authenticated': 'apiErrorSessionInvalid',
  'Invalid or expired session': 'apiErrorSessionInvalid',
  'Admin access required': 'apiErrorAdminRequired',
  'Weighbridge operators cannot register or close out entries': 'apiErrorWeighbridgeCannotRegister',
  'Security guards cannot record weights or upload weighbridge photos': 'apiErrorGuardCannotWeigh',
  'Entry not found': 'apiErrorEntryNotFound',
  'Entry already marked as exited': 'apiErrorEntryAlreadyExited',
  'Photo not found': 'apiErrorPhotoNotFound',
  'At least one active admin is required': 'apiErrorLastAdmin',
  'Username already exists': 'apiErrorUsernameExists',
  'User not found': 'apiErrorUserNotFound',
  'You cannot deactivate your own account': 'apiErrorCannotDeactivateSelf',
  'You cannot change your own role': 'apiErrorCannotChangeOwnRole',
  'You cannot delete your own account': 'apiErrorCannotDeleteSelf',
  'This user has weighbridge records and cannot be deleted. Deactivate the account instead.':
    'apiErrorUserHasWeighbridgeRecords',
  'Action not allowed in the current pass state': 'apiErrorStateNotAllowed',
  'Quality result is required before a GRN': 'apiErrorQualityRequiredForGrn',
  'The GRN approver must be different from the weighbridge operator': 'apiErrorGrnApproverIsWeigher',
  'Weighbridge reading is not stable': 'apiErrorReadingNotStable',
  'Weighbridge indicator did not respond': 'apiErrorIndicatorNoResponse',
  'Tare weight cannot be more than gross weight': 'apiErrorTareAboveGross',
  'A reason is required': 'apiErrorReasonRequired',
  'OCR service is not configured': 'apiErrorOcrNotConfigured',
  'OCR service failed. Enter the details manually.': 'apiErrorOcrFailed',
  'PO number, challan number and at least one challan line are required': 'apiErrorInwardDocsRequired',
  'Confirm the rejected material is on the vehicle': 'apiErrorConfirmRejectedOnVehicle',
  'Every challan line needs a quality result': 'apiErrorQualityLinesMissing',
  'Quality result does not match the line quantities': 'apiErrorQualityResultMismatch',
  'GRN not found': 'apiErrorGrnNotFound',
  'ERP post is not pending': 'apiErrorErpPostNotPending',
  'Your role cannot do this': 'apiErrorRoleNotAllowed',
  'Quality integration is not configured': 'apiErrorQualityIntegrationOff',
  'Weighbridge indicator is not configured': 'apiErrorIndicatorNotConfigured',
  'Weight is required for manual entry': 'apiErrorWeightRequired',
  'Unknown photo kind': 'apiErrorUnknownPhotoKind',
  'Weighment does not belong to this pass': 'apiErrorWeighmentNotOnPass',
  'doc_type must be plate, po or challan': 'apiErrorUnknownDocType',
  'GRN line not found': 'apiErrorGrnLineNotFound',
  'Enter at least 3 characters of the supplier name': 'apiErrorSupplierSearchShort',
}

// The raw `detail` text of an axios error, or null. Store this (not the
// translated message) in state when the message stays on screen, so it
// re-translates if the language changes while it is visible.
export function apiErrorDetail(error) {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() !== '' ? detail : null
}

// Translates a stored `detail` (or null) at render time.
export function translateApiDetail(detail, t, fallbackKey) {
  if (!detail) return t(fallbackKey)
  const key = KEY_BY_API_DETAIL[detail]
  return key ? t(key) : detail
}

// One-shot message for a toast: `showToast(apiErrorMessage(err, t, 'loginFailed'), 'error')`.
export function apiErrorMessage(error, t, fallbackKey) {
  return translateApiDetail(apiErrorDetail(error), t, fallbackKey)
}
