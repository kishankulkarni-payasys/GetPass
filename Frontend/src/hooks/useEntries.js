import { useCallback, useEffect, useRef, useState } from 'react'
import { getEntries } from '../api/entries'
import { useLanguage } from '../context/LanguageContext'
import { apiErrorDetail, translateApiDetail } from '../i18n/apiErrors'

const LOAD_ERROR_KEY = 'errorLoadEntries'

// Loads with the newest filters only: filters can change faster than the
// server answers (e.g. typing a vehicle number), so an older answer that
// arrives late must not replace a newer one.
function useLatestRequest(load, filtersKey) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // Holds { detail } (raw server text or null); translated at render time so
  // the message follows a language switch.
  const [loadError, setLoadError] = useState(null)
  const latestRequestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await load()
      if (requestId === latestRequestRef.current) setData(result)
    } catch (err) {
      if (requestId === latestRequestRef.current) setLoadError({ detail: apiErrorDetail(err) })
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false)
    }
    // `load` is rebuilt every render; the serialized filters decide when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, loadError, refresh }
}

export function useEntries(filters = {}) {
  const { t } = useLanguage()
  const { data, loading, loadError, refresh } = useLatestRequest(() => getEntries(filters), JSON.stringify(filters))

  const error = loadError ? translateApiDetail(loadError.detail, t, LOAD_ERROR_KEY) : null
  return { entries: data ?? [], loading, error, refresh }
}

// Several filtered lists loaded together, e.g. the Gate-out groups:
//   useEntryGroups({ ready: { state: 'GRN_APPROVED' }, waiting: { state: 'GATE_IN' } })
// returns { groups: { ready: [...], waiting: [...] }, loading, error, refresh }.
// The API takes one `state` per request in this app, so each group is its own call.
export function useEntryGroups(groupFilters, errorFallbackKey = LOAD_ERROR_KEY) {
  const { t } = useLanguage()
  const { data, loading, loadError, refresh } = useLatestRequest(async () => {
    const names = Object.keys(groupFilters)
    const lists = await Promise.all(names.map((name) => getEntries(groupFilters[name])))
    return Object.fromEntries(names.map((name, index) => [name, lists[index]]))
  }, JSON.stringify(groupFilters))

  const error = loadError ? translateApiDetail(loadError.detail, t, errorFallbackKey) : null
  return { groups: data ?? {}, loading, error, refresh }
}
