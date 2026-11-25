import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../api/dashboard';
import { queryKeys } from '../api/queryKeys';

const POLL_INTERVAL_MS = 30_000;

/** `enablePolling` should track screen focus so the dashboard doesn't poll in the background. */
export function useDashboardSummary(day: string, enablePolling: boolean) {
  return useQuery({
    queryKey: queryKeys.dashboardSummary(day),
    queryFn: () => getDashboardSummary(day),
    refetchInterval: enablePolling ? POLL_INTERVAL_MS : false,
  });
}
