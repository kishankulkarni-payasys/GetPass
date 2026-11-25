import { QueryClient } from '@tanstack/react-query'
import { subscribeToQueue } from '../offline/gateInQueue'
import { entryKeys } from './queryKeys'

// A 401 is handled once, globally, by apiClient's interceptor (session-expired
// toast + redirect to /login). Retrying it here would just repeat that failed
// request, so queries/mutations never retry a session expiry; other failures
// get one retry since site networks can be flaky.
const HTTP_UNAUTHORIZED = 401
const QUERY_RETRY_LIMIT = 1

function shouldRetry(failureCount, error) {
  if (error?.response?.status === HTTP_UNAUTHORIZED) return false
  return failureCount < QUERY_RETRY_LIMIT
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      // Server data changes from other guards/devices constantly; treat it as
      // stale at once so a mount after navigation always asks again, same as
      // the hand-rolled hooks this replaces.
      staleTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
})

// The offline queue (src/offline/gateInQueue.js) is the source of truth for
// gate-in passes captured without a network. A background sync there creates
// or updates passes without going through a mutation, so nothing would tell
// React Query its entry lists are stale without this: every queue change
// (item queued, sent, or moved to "needs attention") invalidates the entries
// lists so the Entry Log / Gate-out / Weighbridge screens pick up the result.
subscribeToQueue(() => {
  queryClient.invalidateQueries({ queryKey: entryKeys.all })
})
