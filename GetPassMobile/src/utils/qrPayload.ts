// Shared encode/decode for the "scan a pass's own QR code to open it" feature.
// NOT the same payload as the web app's supplier/vehicle pre-fill QR (see
// Frontend/src/utils/qrPayload.js) — this one only ever carries an entry id.
//
// Decoded text comes from a camera scan, so it is untrusted input: validate
// it is a plain object, require entry_id to be a positive integer, and do
// not trust any other field on it.

export interface EntryQrPayload {
  entry_id: number;
  vehicle_number: string;
}

const MAX_VEHICLE_NUMBER_LENGTH = 20;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// Builds the JSON string to encode into a pass's printed/displayed QR code.
export function buildEntryQrPayload(entryId: number, vehicleNumber: string): string {
  const payload: EntryQrPayload = {
    entry_id: entryId,
    vehicle_number: vehicleNumber.trim().slice(0, MAX_VEHICLE_NUMBER_LENGTH),
  };
  return JSON.stringify(payload);
}

// Parses a scanned QR code's raw text. Returns null if it isn't a recognised
// pass QR code (malformed JSON, not an object, or no valid entry_id).
export function parseEntryQrPayload(rawValue: string): EntryQrPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed) || !isPositiveInteger(parsed.entry_id)) return null;

  const vehicleNumber = typeof parsed.vehicle_number === 'string' ? parsed.vehicle_number.trim() : '';
  return {
    entry_id: parsed.entry_id,
    vehicle_number: vehicleNumber.slice(0, MAX_VEHICLE_NUMBER_LENGTH),
  };
}
