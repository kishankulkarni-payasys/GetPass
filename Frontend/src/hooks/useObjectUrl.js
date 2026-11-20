import { useEffect, useState } from 'react'

// Object URL for previewing a File or Blob; revoked when the blob changes or
// the component unmounts so captured photos do not leak memory.
export default function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return url
}
