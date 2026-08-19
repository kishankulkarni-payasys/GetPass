import { useCallback, useEffect, useState } from 'react'
import { getEntries, createEntry, exitEntry } from '../api/entries'

export function useEntries(filters = {}) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getEntries(filters)
      setEntries(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load entries')
    } finally {
      setLoading(false)
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

  return { entries, loading, error, addEntry, markExit, refresh }
}
