import { useQuery } from '@tanstack/react-query'
import { getEntry } from '../api/entries'
import { entryKeys } from '../api/queryKeys'
import { apiErrorDetail } from '../i18n/apiErrors'

// Full pass record (GET /entries/:id). The query key carries the id, so React
// Query already keeps pass A off pass B's screen and shows the fetched data
// while a reload for the same id runs in the background (isFetching, not
// isLoading) instead of flashing a skeleton.
export function usePassDetail(passId) {
  const query = useQuery({
    queryKey: entryKeys.detail(passId),
    queryFn: () => getEntry(passId),
    enabled: passId !== undefined && passId !== null,
  })

  return {
    pass: query.data ?? null,
    loading: query.isLoading,
    failed: query.isError,
    errorDetail: query.isError ? apiErrorDetail(query.error) : null,
    reload: query.refetch,
  }
}
