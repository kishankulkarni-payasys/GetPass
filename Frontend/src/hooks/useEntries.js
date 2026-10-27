import { useCallback, useEffect, useRef, useState } from 'react'
import { getEntries, createEntry, exitEntry } from '../api/entries'
import { useLanguage } from '../context/LanguageContext'

const LOAD_ERROR_KEY = 'errorLoadEntries'

export function useEntries(filters = {}) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()
  // Stores the server's message (or null); the fallback text is translated at
  // render time so it follows the guard's language, even after a switch.
  const [loadError, setLoadError] = useState(null)
  // Filters can change faster than the server answers (e.g. typing a vehicle
  // number); only the newest request may update the list.
  const latestRequestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getEntries(filters)
      if (requestId === latestRequestRef.current) setEntries(data)
    } catch (err) {
      if (requestId === latestRequestRef.current) setLoadError({ detail: err.response?.data?.detail || null })
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addEntry = async (entry) => {
    const created = await createEntry(entry)
    setEntries((prev) => [created, ...prev])
    return created
  }

  const markExit = async (id) => {
    const updated = await exitEntry(id)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }

  const error = loadError ? loadError.detail || t(LOAD_ERROR_KEY) : null

  return { entries, loading, error, addEntry, markExit, refresh }
}
