import { useQuery } from '@tanstack/react-query'
import { getIndicatorReading } from '../api/weighments'
import { weighmentKeys } from '../api/queryKeys'
import { apiErrorDetail } from '../i18n/apiErrors'

// Often enough to see the weight settle, light enough for a site network.
const POLL_INTERVAL_MS = 1500

export const INDICATOR_STATUS = {
  loading: 'loading',
  live: 'live',
  unavailable: 'unavailable',
  failed: 'failed',
}

function statusFor(query) {
  if (query.isPending) return INDICATOR_STATUS.loading
  if (query.isError) return INDICATOR_STATUS.failed
  // No indicator configured: manual entry only (still polling costs nothing,
  // but the status tells the panel to stay in manual mode).
  if (query.data && !query.data.available) return INDICATOR_STATUS.unavailable
  return INDICATOR_STATUS.live
}

// Polls the live indicator while the sheet is open and the tab is visible.
// Returns { status, reading, errorDetail }.
export function useIndicatorReading(enabled) {
  const query = useQuery({
    queryKey: weighmentKeys.indicatorReading(),
    queryFn: getIndicatorReading,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    // Matches the old poll loop, which only ran while the tab was visible.
    refetchIntervalInBackground: false,
    retry: false,
  })

  return {
    status: statusFor(query),
    reading: query.data?.available ? query.data : null,
    errorDetail: query.isError ? apiErrorDetail(query.error) : null,
  }
}
