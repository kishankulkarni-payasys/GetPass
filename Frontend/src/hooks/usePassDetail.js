import { useCallback, useEffect, useState } from 'react'
import { getEntry } from '../api/entries'
import { apiErrorDetail } from '../i18n/apiErrors'

// Full pass record (GET /entries/:id). `reload` keeps the old data on screen
// while it fetches, so a refresh after an action does not flash a skeleton.
export function usePassDetail(passId) {
  const [pass, setPass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [errorDetail, setErrorDetail] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setPass(await getEntry(passId))
    } catch (err) {
      setFailed(true)
      setErrorDetail(apiErrorDetail(err))
    } finally {
      setLoading(false)
    }
  }, [passId])

  useEffect(() => {
    reload()
  }, [reload])

  return { pass, loading, failed, errorDetail, reload }
}
