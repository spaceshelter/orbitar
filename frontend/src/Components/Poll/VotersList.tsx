import React, { useEffect, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

import { UserBaseInfo } from '../../Types/UserInfo'

import styles from './VotersList.module.css'

export const VotersTooltip: React.FC<{ voters: UserBaseInfo[] }> = ({ voters }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTooltip || !tooltipRef.current || !containerRef.current) {
      return
    }

    const container = containerRef.current
    const tooltip = tooltipRef.current
    const rect = container.getBoundingClientRect()

    tooltip.style.top = `${rect.bottom + window.scrollY}px`
    tooltip.style.left = `${rect.left}px`

    const clickHandler = (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      setShowTooltip(false)
      return false
    }
    document.addEventListener('mousedown', clickHandler)
    return () => {
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [showTooltip])

  return (
    <div ref={containerRef} className={styles.votesContainer}>
      <span
        className={voters.length > 0 ? styles.votes : ''}
        onClick={(e) => {
          e.stopPropagation()
          setShowTooltip(!showTooltip)
        }}
      >
        {voters.length} {voters.length === 1 ? 'голос' : 'голосов'}
      </span>
      {showTooltip &&
        voters.length > 0 &&
        createPortal(
          <div ref={tooltipRef} className={styles.votersTooltip}>
            {voters.map((voter) => (
              <div key={voter.id} className={styles.voter}>
                {voter.username}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
