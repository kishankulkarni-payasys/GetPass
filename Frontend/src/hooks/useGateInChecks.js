import { useEffect, useState } from 'react'
import { getEntries } from '../api/entries'
import { getGateInConfig, lookupPo } from '../api/gateIn'
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
  const [config, setConfig] = useState(FALLBACK_GATE_IN_CONFIG)
  useEffect(() => {
    let active = true
    getGateInConfig()
      .then((data) => active && setConfig(data))
      .catch(() => active && setConfig(FALLBACK_GATE_IN_CONFIG))
    return () => {
      active = false
    }
  }, [])
  return config
}

// Runs `check` after the value has been still for a moment and ignores stale
// answers. Returns { data, settled }: `settled` is false while the newest
// value is still being checked.
function useDebouncedCheck(value, enabled, check) {
  const [result, setResult] = useState({ value: null, data: null })
  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    const timer = setTimeout(async () => {
      const data = await check(value)
      if (active) setResult({ value, data })
    }, CHECK_DEBOUNCE_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [value, enabled, check])
  const settled = result.value === value
  return { data: settled ? result.data : null, settled }
}

async function checkPo(poNumber) {
  try {
    const { status, po } = await lookupPo(poNumber)
    return { status, po }
  } catch {
    // Warn-only check (B3): a failed lookup never blocks the pass.
    return { status: PO_CHECK.notChecked, po: null }
  }
}

// PO cross-check result for the typed PO number: { status, po }. Offline: not_checked.
export function usePoCheck(poNumber, { online }) {
  const trimmed = poNumber.trim()
  const { data, settled } = useDebouncedCheck(trimmed, Boolean(trimmed) && online, checkPo)
  if (!trimmed) return { status: PO_CHECK.idle, po: null }
  if (!online) return { status: PO_CHECK.notChecked, po: null }
  return settled ? data : { status: PO_CHECK.checking, po: null }
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
  const enabled = online && plate.length >= MIN_PLATE_LENGTH_FOR_CHECK
  const { data } = useDebouncedCheck(plate, enabled, findOpenPass)
  return enabled ? data : null
}
