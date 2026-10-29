// Offline queue for gate-in passes and their photos (IndexedDB, keyed by
// client_ref). A pass created while offline, or whose photos failed to
// upload, waits here and is sent on the `online` event and on app start.
// Replaying is safe: the API returns the existing pass for a known client_ref.
import { createEntry, uploadPhotos } from '../api/entries'

const DB_NAME = 'getpass-offline'
const DB_VERSION = 1
const STORE = 'gateInQueue'
const HTTP_SERVER_ERROR_MIN = 500
const HTTP_UNAUTHORIZED = 401

export const QUEUE_STATUS = {
  pending: 'pending',
  needsAttention: 'needs_attention',
}

const listeners = new Set()
let syncInFlight = null

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'client_ref' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runInStore(mode, action) {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request?.result)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

function notifyChange() {
  listeners.forEach((listener) => listener())
}

// Called after every queue change; returns an unsubscribe function.
export function subscribeToQueue(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const UUID_BYTES = 16
const UUID_VERSION_BYTE = 6
const UUID_VARIANT_BYTE = 8
const HEX_RADIX = 16
const UUID_GROUPS = [8, 4, 4, 4, 12]

// RFC 4122 v4 id. crypto.randomUUID only exists on HTTPS pages, and gate
// devices may open the app over plain HTTP on the site network.
export function newClientRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES))
  bytes[UUID_VERSION_BYTE] = (bytes[UUID_VERSION_BYTE] & 0x0f) | 0x40
  bytes[UUID_VARIANT_BYTE] = (bytes[UUID_VARIANT_BYTE] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('')
  let offset = 0
  return UUID_GROUPS.map((length) => {
    const group = hex.slice(offset, offset + length)
    offset += length
    return group
  }).join('-')
}

export async function listQueuedPasses() {
  const items = await runInStore('readonly', (store) => store.getAll())
  return (items ?? []).sort((a, b) => a.queued_at.localeCompare(b.queued_at))
}

async function saveItem(item) {
  await runInStore('readwrite', (store) => store.put(item))
  notifyChange()
}

export async function removeQueuedPass(clientRef) {
  await runInStore('readwrite', (store) => store.delete(clientRef))
  notifyChange()
}

// photos: [{ kind, blob, name }]. `passId` is set when the pass already exists
// and only its photos are still waiting.
export async function enqueuePass({ clientRef, body, photos = [], passId = null, vehicleNumber }) {
  await saveItem({
    client_ref: clientRef,
    body,
    photos,
    pass_id: passId,
    vehicle_number: vehicleNumber,
    status: QUEUE_STATUS.pending,
    error: null,
    queued_at: new Date().toISOString(),
  })
}

export async function retryQueuedPass(clientRef) {
  const items = await listQueuedPasses()
  const item = items.find((queued) => queued.client_ref === clientRef)
  if (!item) return
  await saveItem({ ...item, status: QUEUE_STATUS.pending, error: null })
  await syncGateInQueue()
}

// No response (offline, timeout) or a server error: try again later.
// Anything else (4xx) means the data itself was refused: the item is kept as
// "needs attention" for the guard to look at.
function isRetryLater(error) {
  const status = error?.response?.status
  // An expired session is not the data's fault: send again after the next sign-in.
  return !status || status === HTTP_UNAUTHORIZED || status >= HTTP_SERVER_ERROR_MIN
}

// Each uploaded photo is dropped from the stored item at once, so a retry
// never uploads it twice.
async function sendPhotos(item) {
  while (item.photos.length > 0) {
    const [photo, ...rest] = item.photos
    const file = new File([photo.blob], photo.name, { type: photo.blob.type })
    await uploadPhotos(item.pass_id, [file], { kind: photo.kind })
    item.photos = rest
    await saveItem(item)
  }
}

// Returns false when the network is still down, so the loop stops early.
async function sendItem(item) {
  const current = { ...item }
  try {
    if (!current.pass_id) {
      const created = await createEntry(current.body)
      current.pass_id = created.id
      await saveItem(current)
    }
    await sendPhotos(current)
    await removeQueuedPass(current.client_ref)
    return true
  } catch (error) {
    if (isRetryLater(error)) return false
    const detail = error.response?.data?.detail
    const latest = (await listQueuedPasses()).find(({ client_ref: ref }) => ref === current.client_ref) ?? current
    await saveItem({ ...latest, status: QUEUE_STATUS.needsAttention, error: typeof detail === 'string' ? detail : null })
    return true
  }
}

async function syncPendingItems() {
  const items = await listQueuedPasses()
  for (const item of items.filter(({ status }) => status === QUEUE_STATUS.pending)) {
    const reachable = await sendItem(item)
    if (!reachable) return
  }
}

// One sync at a time; callers share the running one.
export function syncGateInQueue() {
  if (!navigator.onLine) return Promise.resolve()
  if (!syncInFlight) {
    syncInFlight = syncPendingItems().finally(() => {
      syncInFlight = null
    })
  }
  return syncInFlight
}
