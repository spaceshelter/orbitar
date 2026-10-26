import { useEffect, useRef } from 'react'

// Listens to a document event while `enabled`, e.g. to close a popup on a click
// elsewhere or on Escape. The listener of the latest render is the one called, so
// callers need not memoize it and the subscription survives re-renders.
export default function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  enabled = true,
) {
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    if (!enabled) return
    const handle = (event: DocumentEventMap[K]) => listenerRef.current(event)
    document.addEventListener(type, handle)
    return () => document.removeEventListener(type, handle)
  }, [type, enabled])
}
