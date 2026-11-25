import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../api/entries'
import { entryKeys } from '../api/queryKeys'
import { apiErrorDetail } from '../i18n/apiErrors'

// Loads GET /entries for the given filters.
// `errorDetail` is the server's text (or null with `failed` true), translated by the screen.
export function usePassList(filters) {
  const query = useQuery({
    queryKey: entryKeys.list(filters),
    queryFn: () => getEntries(filters),
  })

  return {
    passes: query.data ?? [],
    loading: query.isFetching,
    failed: query.isError,
    errorDetail: query.isError ? apiErrorDetail(query.error) : null,
    refresh: query.refetch,
  }
}
