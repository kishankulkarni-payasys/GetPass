import { useCallback, useEffect, useState } from 'react'
import {
  QUEUE_STATUS,
  listQueuedPasses,
  removeQueuedPass,
  retryQueuedPass,
  subscribeToQueue,
  syncGateInQueue,
} from '../offline/gateInQueue'

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

// Sends queued gate-in passes on start and whenever the device comes back
// online. `storageError` is true when the browser blocks IndexedDB (private
// mode): the queue then cannot hold passes, so offline capture is off.
export function useGateInQueueSync(enabled) {
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    const sync = () => syncGateInQueue().catch(() => setStorageError(true))
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [enabled])

  return storageError
}

// Queued items for the gate-in screen: pending ones and those that need attention.
export function useGateInQueue() {
  const [items, setItems] = useState([])
  const [storageError, setStorageError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setItems(await listQueuedPasses())
    } catch {
      setStorageError(true)
    }
  }, [])

  useEffect(() => {
    reload()
    return subscribeToQueue(reload)
  }, [reload])

  const pending = items.filter(({ status }) => status === QUEUE_STATUS.pending)
  const needsAttention = items.filter(({ status }) => status === QUEUE_STATUS.needsAttention)

  return {
    pending,
    needsAttention,
    storageError,
    retry: retryQueuedPass,
    discard: removeQueuedPass,
    syncNow: syncGateInQueue,
  }
}
