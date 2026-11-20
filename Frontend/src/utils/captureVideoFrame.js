// Quality 0.85 keeps plate and document text sharp for OCR at roughly a third
// of the size of a lossless frame, so uploads stay quick on weak networks.
export const CAPTURE_JPEG_QUALITY = 0.85
export const CAPTURE_MIME_TYPE = 'image/jpeg'

// Draws the current video frame at its native resolution and encodes it as JPEG.
export function captureVideoFrame(video) {
  return new Promise((resolve, reject) => {
    const { videoWidth, videoHeight } = video
    if (!videoWidth || !videoHeight) {
      reject(new Error('Camera frame is not ready'))
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = videoWidth
    canvas.height = videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, videoWidth, videoHeight)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Camera frame could not be encoded'))),
      CAPTURE_MIME_TYPE,
      CAPTURE_JPEG_QUALITY,
    )
  })
}
