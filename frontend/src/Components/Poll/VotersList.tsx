import React, { useCallback, useEffect, useRef, useState } from 'react'

import Username from '@components/Username'
import { UserBaseInfo } from '@entities/UserInfo'
import { useAPI } from '@state/AppState'
import classNames from 'classnames'
// import { pluralize } from '@utils/utils'
import { createPortal } from 'react-dom'

import styles from './VotersList.module.css'

export const VotersTooltip: React.FC<{ pollId: number; optionId: number; votesCount: number }> = ({
  pollId,
  optionId,
  votesCount,
}) => {
  const [voters, setVoters] = useState<UserBaseInfo[]>([])
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const api = useAPI()

  const fetchVoters = useCallback(async () => {
    try {
      const votersData = await api.pollAPI.getVoters({ pollId, optionId })
      setVoters(votersData.voters)
    } catch (err) {
      console.error('Не удалось загрузить список голосовавших', err)
    }
  }, [pollId, optionId, api.pollAPI])

  useEffect(() => {
    if (!showTooltip || !tooltipRef.current || !containerRef.current || votesCount === 0) {
      return
    }

    fetchVoters()

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
  }, [showTooltip, fetchVoters, votesCount])

  const handleTooltipClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (votesCount === 0) {
      return
    }

    e.stopPropagation()
    setShowTooltip(!showTooltip)
  }

  return (
    <div ref={containerRef} className={styles.votesContainer} onClick={handleTooltipClick}>
      {votesCount > 0 && (
        <span className={styles.votes}>
          {votesCount}
          <span className={classNames('i i-user', styles.userIcon)} />
        </span>
      )}

      {showTooltip &&
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
