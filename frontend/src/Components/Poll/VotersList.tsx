import React, { useEffect, useRef, useState } from 'react'

import Username from '@components/Username'
import { UserBaseInfo } from '@entities/UserInfo'
import { pluralize } from '@utils/utils'
import { createPortal } from 'react-dom'

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
    tooltip.style.right = `${document.documentElement.clientWidth - rect.right}px`

    const clickHandler = (e: MouseEvent) => {
      // Check if the click is inside the tooltip
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return // Don't close if clicked inside tooltip
      }

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
      {voters.length > 0 && (
        <span
          className={voters.length > 0 ? styles.votes : ''}
          onClick={(e) => {
            e.stopPropagation()
            setShowTooltip(!showTooltip)
          }}
        >
          {pluralize(voters.length, ['голос', 'голоса', 'голосов'])}
        </span>
      )}

      {showTooltip &&
        voters.length > 0 &&
        createPortal(
          <div ref={tooltipRef} className={styles.votersTooltip}>
            <div className={styles.votersContent}>
              {voters.map((voter) => (
                <Username user={voter} key={voter.id} className={styles.voter} />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
