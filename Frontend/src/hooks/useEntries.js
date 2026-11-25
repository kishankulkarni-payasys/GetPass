import { useQueries, useQuery } from '@tanstack/react-query'
import { getEntries } from '../api/entries'
import { entryKeys } from '../api/queryKeys'
import { useLanguage } from '../context/LanguageContext'
import { apiErrorDetail, translateApiDetail } from '../i18n/apiErrors'

const LOAD_ERROR_KEY = 'errorLoadEntries'

export function useEntries(filters = {}) {
  const { t } = useLanguage()
  const query = useQuery({
    queryKey: entryKeys.list(filters),
    queryFn: () => getEntries(filters),
  })

  const error = query.isError ? translateApiDetail(apiErrorDetail(query.error), t, LOAD_ERROR_KEY) : null
  return { entries: query.data ?? [], loading: query.isFetching, error, refresh: query.refetch }
}

// Several filtered lists loaded together, e.g. the Gate-out groups:
//   useEntryGroups({ ready: { state: 'GRN_APPROVED' }, waiting: { state: 'GATE_IN' } })
// returns { groups: { ready: [...], waiting: [...] }, loading, error, refresh }.
// The API takes one `state` per request in this app, so each group is its own query,
// run together so one group's slow answer does not hold back the others.
export function useEntryGroups(groupFilters, errorFallbackKey = LOAD_ERROR_KEY) {
  const { t } = useLanguage()
  const names = Object.keys(groupFilters)
  const results = useQueries({
    queries: names.map((name) => ({
      queryKey: entryKeys.list(groupFilters[name]),
      queryFn: () => getEntries(groupFilters[name]),
    })),
  })

  const groups = Object.fromEntries(names.map((name, index) => [name, results[index].data ?? []]))
  const loading = results.some((result) => result.isFetching)
  const failed = results.find((result) => result.isError)
  const error = failed ? translateApiDetail(apiErrorDetail(failed.error), t, errorFallbackKey) : null
  const refresh = () => results.forEach((result) => result.refetch())

  return { groups, loading, error, refresh }
}
