import { useCallback, useEffect, useRef, useState } from 'react'
import { getEntry } from '../api/entries'
import { apiErrorDetail } from '../i18n/apiErrors'

const NO_RESULT = { passId: null, pass: null, failed: false, errorDetail: null }

// Full pass record (GET /entries/:id). `reload` keeps the old data on screen
// while it fetches, so a refresh after an action does not flash a skeleton.
// Pages are not remounted per id, so each result is tagged with the id it was
// fetched for: pass A is never shown (or used for the breadcrumb) on pass B's URL.
export function usePassDetail(passId) {
  const [result, setResult] = useState(NO_RESULT)
  const [fetching, setFetching] = useState(true)
  const currentIdRef = useRef(passId)
  currentIdRef.current = passId

  const reload = useCallback(async () => {
    // A slow answer for a pass the user has already left must not land on the new one.
    const isCurrent = () => currentIdRef.current === passId
    setFetching(true)
    try {
      const pass = await getEntry(passId)
      if (isCurrent()) setResult({ ...NO_RESULT, passId, pass })
    } catch (err) {
      if (!isCurrent()) return
      const errorDetail = apiErrorDetail(err)
      setResult((prev) => ({ passId, pass: prev.passId === passId ? prev.pass : null, failed: true, errorDetail }))
    } finally {
      if (isCurrent()) setFetching(false)
    }
  }, [passId])

  useEffect(() => {
    reload()
  }, [reload])

  const isForCurrentId = result.passId === passId
  return {
    pass: isForCurrentId ? result.pass : null,
    loading: fetching || !isForCurrentId,
    failed: isForCurrentId && result.failed,
    errorDetail: isForCurrentId ? result.errorDetail : null,
    reload,
  }
}
