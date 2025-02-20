import React, { useEffect } from 'react'

import { ThemePreview } from '../Components/ThemePreview'

import styles from './FeedPage.module.scss'

export default function ThemePreviewPage() {
  useEffect(() => {
    document.title = 'Тема'
  }, [])

  return (
    <div className={styles.container}>
      <ThemePreview />
    </div>
  )
}
