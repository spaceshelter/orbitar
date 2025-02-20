import { useEffect } from 'react'

const useOnBack = (onBack: () => void) => {
  useEffect(() => {
    const handleBack = () => onBack()
    if (!window.history.state.popupOpen) {
      window.history.pushState({ popupOpen: true }, '')
    }
    window.addEventListener('popstate', handleBack)
    return () => {
      window.removeEventListener('popstate', handleBack)
      if (window.history.state && window.history.state.popupOpen) {
        window.history.back()
      }
    }
  }, [])
}

export default useOnBack
