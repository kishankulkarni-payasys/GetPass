import { useEffect, useState } from 'react'
import { getIndicatorReading } from '../api/weighments'
import { apiErrorDetail } from '../i18n/apiErrors'

// Often enough to see the weight settle, light enough for a site network.
const POLL_INTERVAL_MS = 1500

export const INDICATOR_STATUS = {
  loading: 'loading',
  live: 'live',
  unavailable: 'unavailable',
  failed: 'failed',
}

// Polls the live indicator while the sheet is open and the tab is visible.
// Returns { status, reading, errorDetail }.
export function useIndicatorReading(enabled) {
  const [state, setState] = useState({ status: INDICATOR_STATUS.loading, reading: null, errorDetail: null })

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    let timer = null

    const poll = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const reading = await getIndicatorReading()
          if (!active) return
          // No indicator configured: stop polling, manual entry only.
          if (!reading.available) {
            setState({ status: INDICATOR_STATUS.unavailable, reading: null, errorDetail: null })
            return
          }
          setState({ status: INDICATOR_STATUS.live, reading, errorDetail: null })
        } catch (err) {
          if (!active) return
          setState((prev) => ({ ...prev, status: INDICATOR_STATUS.failed, errorDetail: apiErrorDetail(err) }))
        }
      }
      if (active) timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled])

  return state
}
