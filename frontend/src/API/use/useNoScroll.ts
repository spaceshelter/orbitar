import { useEffect } from 'react'

let noScrollCount = 0
export default function useNoScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    noScrollCount++
    const htmlElement = document.documentElement
    htmlElement.classList.add('no-scroll')
    return () => {
      noScrollCount--
      if (noScrollCount === 0) {
        htmlElement.classList.remove('no-scroll')
      }
    }
  }, [enabled])
}
