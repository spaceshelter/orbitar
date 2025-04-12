import React, { useState } from 'react'

import { FaSyncAlt } from 'react-icons/fa'

import styles from './RefreshButton.module.scss'

interface RefreshButtonProps {
  onClick: () => Promise<void>
  title?: string
  disabled?: boolean
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ onClick, title = 'Обновить', disabled = false }) => {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRefreshing || disabled) return

    setIsRefreshing(true)
    try {
      await onClick()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500) // Match animation duration
    }
  }

  return (
    <button
      className={`${styles.refreshButton} ${isRefreshing ? styles.rotating : ''}`}
      onClick={handleClick}
      title={title}
      disabled={disabled}
    >
      <FaSyncAlt size={14} />
    </button>
  )
}
