import React, { useCallback, useEffect, useState } from 'react'

import DateComponent from '@components/DateComponent'

import PollService from '../../Services/PollService'
import { Poll as PollType } from '../../Types/Poll'

import styles from './Poll.module.css'

interface PollProps {
  pollId: string
}

export const Poll: React.FC<PollProps> = ({ pollId }) => {
  const [poll, setPoll] = useState<PollType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])

  const fetchPoll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const pollData = await PollService.getPoll(pollId)
      setPoll(pollData)
      setSelectedOptions(pollData.userVoted || [])
    } catch (err) {
      setError('Не удалось загрузить опрос')
    } finally {
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => {
    fetchPoll()
  }, [fetchPoll])

  const handleVote = async (optionId: number) => {
    const hasVoted = poll?.userVoted?.includes(optionId)
    const isMultipleVotesAllowed = poll?.settings.allowMultipleVotes
    const hasAnyVotes = (poll?.userVoted ?? []).length > 0
    const isPollExpired = poll?.settings.expiresAt && new Date(poll.settings.expiresAt) < new Date()
    if (!poll || hasVoted || (!isMultipleVotesAllowed && hasAnyVotes) || isPollExpired) return

    try {
      const response = await PollService.vote({ poll_id: Number(pollId), option_ids: [Number(optionId)] })
      if (response) {
        const updatedPoll = await PollService.getPoll(pollId)
        setPoll(updatedPoll)
        setSelectedOptions((prevOptions) => [...prevOptions, optionId])
      }
    } catch (err) {
      setError('Не удалось отправить голос')
    }
  }

  const handleRescindVote = async () => {
    if (!poll || !poll.userVoted || !poll.settings.allowVoteRescinding) return

    try {
      const response = await PollService.rescindVote(Number(pollId))
      if (response) {
        const updatedPoll = await PollService.getPoll(pollId)
        setPoll(updatedPoll)
        setSelectedOptions([])
      }
    } catch (err) {
      setError('Не удалось отменить голос')
    }
  }

  const calculatePercentage = (votes: number) => {
    if (!poll || poll.totalVotes === 0) return 0
    return Math.round((votes / poll.totalVotes) * 100)
  }

  if (loading) return <div className={styles.loading}>Загрузка...</div>
  if (error) return <div className={styles.error}>{error}</div>
  if (!poll) return null

  const showResults = poll.settings.resultVisibility || poll.userVoted
  const isPollExpired = poll?.settings.expiresAt && new Date(poll.settings.expiresAt) < new Date()

  const renderOptions = () => {
    const isMultipleVotesAllowed = poll?.settings.allowMultipleVotes
    const hasAnyVotes = (poll?.userVoted ?? []).length > 0

    return poll.options.map((option, idx) => {
      const percentage = calculatePercentage(option.votes)
      const isSelected = selectedOptions.includes(idx)
      const hasVoted = (poll.userVoted ?? []).includes(idx)
      const isDisabled = isPollExpired || hasVoted || (!isMultipleVotesAllowed && hasAnyVotes)

      return (
        <div
          key={`${idx}-${poll.poll_id}`}
          className={[styles.option, isSelected && styles.selected, isDisabled && styles.disabled]
            .filter(Boolean)
            .join(' ')}
          onClick={() => !isDisabled && handleVote(idx)}
          style={{ cursor: isDisabled ? 'default' : 'pointer' }}
        >
          <div className={styles.progressBar} style={{ width: `${percentage}%` }} />
          <div className={styles.optionContent}>
            <span className={styles.optionText}>{option.text}</span>
            {showResults && (
              <div className={styles.results}>
                <span className={styles.votes}>
                  {option.votes} {option.votes === 1 ? 'голос' : 'голосов'}
                </span>
                <span className={styles.percentage}>{percentage}%</span>
              </div>
            )}
          </div>
        </div>
      )
    })
  }

  const renderPollExpiration = () => {
    if (isPollExpired) {
      return (
        <div className={styles.expiration}>
          <span>Опрос завершен</span>
        </div>
      )
    }

    if (poll.settings.expiresAt) {
      return (
        <div className={styles.expiration}>
          <span>Опрос завершится: </span>
          <DateComponent date={new Date(poll.settings.expiresAt)} />
        </div>
      )
    }
  }

  const renderTotalVotes = () => {
    return (
      <>
        Всего голосов: {poll.totalVotes || 0}
        {poll.userVoted && poll.settings.allowVoteRescinding && !isPollExpired && (
          <button className={styles.rescindButton} onClick={handleRescindVote}>
            Отменить голос
          </button>
        )}
      </>
    )
  }

  return (
    <div className={styles.pollContainer}>
      <h3 className={styles.question}>{poll.question}</h3>

      <div className={styles.options}>{renderOptions()}</div>

      {renderPollExpiration()}

      <div className={styles.totalVotes}>{renderTotalVotes()}</div>
    </div>
  )
}
