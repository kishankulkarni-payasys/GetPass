// Gate-in submit path shared by the inward and other-vehicle forms: create
// the pass online and upload its photos, or queue both when the network is down.
import { createEntry, uploadPhotos } from '../api/entries'
import { enqueuePass } from './gateInQueue'

export const SUBMIT_OUTCOMES = {
  created: 'created',
  queued: 'queued',
  photosPending: 'photos_pending',
}

function photoQueueItems(photos) {
  return Object.entries(photos).map(([kind, file]) => ({ kind, blob: file, name: file.name || `${kind}.jpg` }))
}

// Uploads each photo with its kind; returns the ones that failed so they can be queued.
async function uploadPassPhotos(passId, photoItems) {
  const failed = []
  for (const item of photoItems) {
    try {
      await uploadPhotos(passId, [new File([item.blob], item.name, { type: item.blob.type })], { kind: item.kind })
    } catch {
      failed.push(item)
    }
  }
  return failed
}

// Sends the pass online, or queues it (with its photos) when there is no network.
// Returns { outcome, pass? }; throws when the API refuses the pass (4xx), so
// the guard can fix the form instead of finding it later in the queue.
export async function submitGateInPass({ payload, photos, online }) {
  const queueItem = { clientRef: payload.client_ref, body: payload, photos: photoQueueItems(photos), vehicleNumber: payload.vehicle_number }
  if (!online) {
    await enqueuePass(queueItem)
    return { outcome: SUBMIT_OUTCOMES.queued }
  }
  let created
  try {
    created = await createEntry(payload)
  } catch (err) {
    if (err.response) throw err
    await enqueuePass(queueItem)
    return { outcome: SUBMIT_OUTCOMES.queued }
  }
  const failed = await uploadPassPhotos(created.id, queueItem.photos)
  if (failed.length === 0) return { outcome: SUBMIT_OUTCOMES.created, pass: created }
  await enqueuePass({ ...queueItem, photos: failed, passId: created.id })
  return { outcome: SUBMIT_OUTCOMES.photosPending, pass: created }
}
