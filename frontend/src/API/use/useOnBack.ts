import { useEffect, useRef } from 'react'

const useOnBack = (onBack: () => void, enabled = true) => {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  useEffect(() => {
    if (!enabled) return

    const handleBack = () => onBackRef.current()
    // Preserve existing state (e.g., React Router state) while adding our flag
    window.history.pushState({ ...window.history.state, popupOpen: true }, '')
    window.addEventListener('popstate', handleBack)
    return () => {
      window.removeEventListener('popstate', handleBack)
      if (window.history.state?.popupOpen) {
        window.history.back()
      }
    }
  }, [enabled])
}

export default useOnBack
