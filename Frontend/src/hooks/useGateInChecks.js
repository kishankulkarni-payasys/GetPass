import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../api/entries'
import { getGateInConfig, lookupPo } from '../api/gateIn'
import { gateInKeys } from '../api/queryKeys'
import { PASS_STATES } from '../utils/passStates'
import { normalizePlate } from '../utils/plate'

// Used until /gate-in/config answers, and offline: typing only, the spec defaults.
export const FALLBACK_GATE_IN_CONFIG = {
  ocr_enabled: false,
  po_lookup_enabled: false,
  ocr_confidence_threshold: 85,
  max_challan_lines: 20,
}

const CHECK_DEBOUNCE_MS = 500
const MIN_PLATE_LENGTH_FOR_CHECK = 6
const OPEN_STATES = Object.values(PASS_STATES).filter(
  (state) => state !== PASS_STATES.gateOut && state !== PASS_STATES.cancelled,
)

export const PO_CHECK = {
  idle: 'idle',
  checking: 'checking',
  matched: 'matched',
  notFound: 'not_found',
  notChecked: 'not_checked',
}

export function useGateInConfig() {
  const query = useQuery({
    queryKey: gateInKeys.config(),
    queryFn: getGateInConfig,
    // Offline (or before the first answer) the form still works with the spec
    // defaults, so a failed/slow config fetch never blocks gate-in.
    placeholderData: FALLBACK_GATE_IN_CONFIG,
    retry: false,
  })
  return query.data ?? FALLBACK_GATE_IN_CONFIG
}

// Debounces `value` and only then lets the query for it run, so typing
// "MH12AB1234" fires one request, not ten; React Query caches each settled
// value so re-typing the same plate/PO does not refetch it.
function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

async function checkPo(poNumber) {
  try {
    return await lookupPo(poNumber)
  } catch {
    // Warn-only check (B3): a failed lookup never blocks the pass.
    return { status: PO_CHECK.notChecked, po: null }
  }
}

// PO cross-check result for the typed PO number: { status, po }. Offline: not_checked.
export function usePoCheck(poNumber, { online }) {
  const trimmed = poNumber.trim()
  const debounced = useDebouncedValue(trimmed, CHECK_DEBOUNCE_MS)
  const enabled = Boolean(debounced) && online
  const query = useQuery({
    queryKey: gateInKeys.poLookup(debounced),
    queryFn: () => checkPo(debounced),
    enabled,
    retry: false,
  })

  if (!trimmed) return { status: PO_CHECK.idle, po: null }
  if (!online) return { status: PO_CHECK.notChecked, po: null }
  if (debounced !== trimmed || query.isPending) return { status: PO_CHECK.checking, po: null }
  return query.data ?? { status: PO_CHECK.checking, po: null }
}

async function findOpenPass(plate) {
  try {
    const passes = await getEntries({ vehicle_number: plate, state: OPEN_STATES })
    return passes.find((pass) => normalizePlate(pass.vehicle_number) === plate) ?? null
  } catch {
    return null
  }
}

// An open pass for the same plate is only a warning (B15).
export function useOpenPassWarning(vehicleNumber, { online }) {
  const plate = normalizePlate(vehicleNumber)
  const debounced = useDebouncedValue(plate, CHECK_DEBOUNCE_MS)
  const enabled = online && debounced.length >= MIN_PLATE_LENGTH_FOR_CHECK
  const query = useQuery({
    queryKey: gateInKeys.openPass(debounced),
    queryFn: () => findOpenPass(debounced),
    enabled,
    retry: false,
  })

  if (!enabled || debounced !== plate) return null
  return query.data ?? null
}
