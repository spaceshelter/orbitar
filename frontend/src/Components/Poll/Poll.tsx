import React, { useCallback, useEffect, useState } from 'react'

import DateComponent from '@components/DateComponent'
import { useAPI } from '@state/AppState'
import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import Radio from '@ui/Radio'
import { pluralize } from '@utils/utils'
import { toast } from 'react-toastify'

import PollService from '../../Services/PollService'
import { Poll as PollType } from '../../Types/Poll'
import { VotersTooltip } from './VotersList'

import styles from './Poll.module.css'

interface PollProps {
  pollId: string
}

export const Poll: React.FC<PollProps> = ({ pollId }) => {
  const api = useAPI()
  const pollService = PollService(api.pollAPI)
  const [poll, setPoll] = useState<PollType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasUserVoted = (poll?.userVoted ?? []).length > 0
  const isPollExpired = poll?.settings.expiresAt && poll.settings.expiresAt < new Date()

  const fetchPoll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const pollData = await pollService.getPoll(pollId)
      setPoll(pollData)
      setSelectedOptions(pollData.userVoted || [])
    } catch (err) {
      setError('Не удалось загрузить опрос')
    } finally {
      setLoading(false)
    }
  }, [pollId, pollService])

  useEffect(() => {
    fetchPoll()
  }, [fetchPoll])

  const handleOptionSelect = (optionId: number) => {
    if (!poll || isPollExpired || hasUserVoted) return

    const isMultipleVotesAllowed = poll.settings.allowMultipleVotes
    setSelectedOptions((prev) => {
      if (isMultipleVotesAllowed) {
        return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      } else {
        return [optionId]
      }
    })
  }

  const handleSubmitVote = async () => {
    if (!poll || selectedOptions.length === 0 || isPollExpired || hasUserVoted) return

    setIsSubmitting(true)
    try {
      const response = await pollService.vote({
        poll_id: Number(pollId),
        option_ids: selectedOptions.map(Number),
      })
      if (response) {
        const updatedPoll = await pollService.getPoll(pollId)
        setPoll(updatedPoll)
      }
    } catch (err) {
      toast.error('Не удалось проголосовать')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRescindVote = async () => {
    if (!poll || !poll.settings.allowVoteRescinding || isPollExpired) return

    try {
      await pollService.vote({ poll_id: Number(pollId), option_ids: [] })
      const updatedPoll = await pollService.getPoll(pollId)
      setPoll(updatedPoll)
      setSelectedOptions([])
    } catch (err) {
      toast.error('Не удалось отменить голос')
    }
  }

  const calculatePercentage = (votes: number) => {
    if (!poll || poll.totalVotes === 0) return 0
    return Math.round((votes / poll.totalVotes) * 100)
  }

  if (loading) return <div className={styles.loading}>Загрузка...</div>
  if (error) {
    return <div className={styles.error}>{error}</div>
  }
  if (!poll) return null

  const renderOptions = () => {
    const isMultipleVotesAllowed = poll?.settings.allowMultipleVotes
    const hasAnyVotes = (poll?.userVoted ?? []).length > 0

    const canShowResults = (() => {
      switch (poll?.settings.resultVisibility) {
        case 'always':
          return true
        case 'after_vote':
          return hasUserVoted
        case 'after_vote_end':
          return hasUserVoted && isPollExpired
        default:
          return false
      }
    })()

    return poll.options.map((option, idx) => {
      const percentage = calculatePercentage(option.votes)
      const isSelected = selectedOptions.includes(idx)
      const isDisabled = isPollExpired || hasUserVoted || (!isMultipleVotesAllowed && hasAnyVotes)

      return (
        <div
          key={`${idx}-${poll.id}`}
          className={[styles.option, isSelected && styles.selected, isDisabled && styles.disabled]
            .filter(Boolean)
            .join(' ')}
          style={{ cursor: isDisabled ? 'default' : 'pointer' }}
          onClick={() => handleOptionSelect(idx)}
        >
          <div className={styles.optionContent}>
            <div className={styles.optionSelect}>
              {isMultipleVotesAllowed ? (
                <Checkbox
                  id={`poll-option-${idx}-${poll.id}`}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {}}
                />
              ) : (
                <Radio
                  id={`poll-option-${idx}-${poll.id}`}
                  checked={isSelected}
                  disabled={isDisabled}
                  name={`poll-option-${poll.id}`}
                  onChange={() => {}}
                />
              )}
            </div>
            <span className={styles.optionText}>{option.text}</span>
            {canShowResults && (
              <>
                <div className={styles.votesContainer}>
                  <span className={styles.votes}>
                    <VotersTooltip pollId={poll.id} optionId={idx} votesCount={option.votes} />
                  </span>
                </div>
                <div className={styles.results}>
                  <span className={styles.percentage}>{percentage}%</span>
                </div>
              </>
            )}
          </div>
          <div className={styles.progressBar} style={{ width: `${percentage}%` }} />
        </div>
      )
    })
  }

  const renderPollExpiration = () => {
    if (isPollExpired) {
      return null
    }

    if (poll.settings.expiresAt) {
      return (
        <div className={styles.expiration}>
          <span>Окончание: </span>
          <DateComponent date={poll.settings.expiresAt} />
        </div>
      )
    }
  }

  const renderTotalVotes = () => {
    return (
      <div className={styles.totalVotes}>
        {poll.totalVotes === 0 ? '' : pluralize(poll.totalVotes || 0, ['голос', 'голоса', 'голосов']) + ' всего'}
      </div>
    )
  }

  const renderActions = () => {
    if (isPollExpired)
      return (
        <div className={styles.expiration}>
          <span>Опрос завершен</span>
        </div>
      )

    if (hasUserVoted && poll.settings.allowVoteRescinding) {
      return (
        <div className={styles.voteButtonContainer}>
          <Button variant='danger' onClick={handleRescindVote}>
            Отменить голос
          </Button>
        </div>
      )
    }

    if (!hasUserVoted) {
      return (
        <div className={styles.voteButtonContainer}>
          <Button variant='positive' onClick={handleSubmitVote} disabled={selectedOptions.length === 0 || isSubmitting}>
            Голосовать
          </Button>
        </div>
      )
    }
  }

  return (
    <div className={styles.pollContainer}>
      <h3 className={styles.question}>{poll.question}</h3>

      <div className={styles.options}>{renderOptions()}</div>

      <div className={styles.footer}>
        <div className={styles.actionsContainer}>{renderActions()}</div>
        <div className={styles.infoContainer}>
          {renderTotalVotes()}
          {renderPollExpiration()}
        </div>
      </div>
    </div>
  )
}
