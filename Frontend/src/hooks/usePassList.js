import { useCallback, useEffect, useRef, useState } from 'react'
import { getEntries } from '../api/entries'
import { apiErrorDetail } from '../i18n/apiErrors'

// Loads GET /entries for the given filters. Filters can change faster than
// the server answers; only the newest request may update the list.
// `errorDetail` is the server's text (or null with `failed` true), translated by the screen.
export function usePassList(filters) {
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [errorDetail, setErrorDetail] = useState(null)
  const latestRequestRef = useRef(0)
  const filtersKey = JSON.stringify(filters)

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    setFailed(false)
    try {
      const data = await getEntries(JSON.parse(filtersKey))
      if (requestId === latestRequestRef.current) setPasses(data)
    } catch (err) {
      if (requestId !== latestRequestRef.current) return
      setFailed(true)
      setErrorDetail(apiErrorDetail(err))
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false)
    }
  }, [filtersKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { passes, loading, failed, errorDetail, refresh }
}
