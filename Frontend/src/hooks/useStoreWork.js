import { useCallback, useEffect, useState } from 'react'
import { approveGrn, editGrnLines, getGrn, getStoreWorkList, retryGrnPost } from '../api/grn'
import { getEntry } from '../api/entries'
import { apiErrorDetail } from '../i18n/apiErrors'

// Store work list (GET /grn): send for inspection, ready for GRN, drafts, pending ERP post.
export function useStoreWorkList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [errorDetail, setErrorDetail] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setItems(await getStoreWorkList())
    } catch (err) {
      setFailed(true)
      setErrorDetail(apiErrorDetail(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, loading, failed, errorDetail, refresh }
}

// One GRN plus its pass (for PO, challan and gross weight in the header).
// Actions return the updated GRN and throw API errors for the screen to show.
export function useGrnRecord(entryId) {
  const [grn, setGrn] = useState(null)
  const [pass, setPass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorDetail, setErrorDetail] = useState(null)
  const [failed, setFailed] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [grnData, passData] = await Promise.all([getGrn(entryId), getEntry(entryId)])
      setGrn(grnData)
      setPass(passData)
    } catch (err) {
      setFailed(true)
      setErrorDetail(apiErrorDetail(err))
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    reload()
  }, [reload])

  const runAndStore = useCallback(async (action) => {
    const updated = await action()
    setGrn(updated)
    return updated
  }, [])

  return {
    grn,
    pass,
    loading,
    failed,
    errorDetail,
    reload,
    saveLines: (lines) => runAndStore(() => editGrnLines(entryId, lines)),
    approve: () => runAndStore(() => approveGrn(entryId)),
    retryPost: () => runAndStore(() => retryGrnPost(entryId)),
  }
}
