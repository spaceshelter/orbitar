import React, { useCallback, useEffect, useState } from 'react'

import DateComponent from '@components/DateComponent'
import { VotersTooltip } from '@components/Poll/VotersList'
import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import Radio from '@ui/Radio'
import { pluralize } from '@utils/utils'
import { toast } from 'react-toastify'

import { PollEntity } from '../../API/types/Poll'

import styles from './Poll.module.css'

interface PollProps {
  pollId: string
}

export const PollComponent: React.FC<PollProps> = ({ pollId }) => {
  const api = useAPI()
  const [poll, setPoll] = useState<PollEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const { userRestrictions } = useAppState()

  const hasUserVoted = (poll?.userVotes ?? []).length > 0
  const isPollExpired = poll?.expires && poll.expires < new Date()
  const allowedToVote = poll?.settings.voteAccess !== 'usersWithFullRights' || userRestrictions?.canVoteKarma

  const fetchPoll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const pollData = await api.poll.getPollCached(pollId)
      setPoll(pollData)
      setSelectedOptions(pollData.userVotes || [])
    } catch (err) {
      setError('Не удалось загрузить опрос')
    } finally {
      setLoading(false)
    }
  }, [pollId, api.poll])

  useEffect(() => {
    fetchPoll()
  }, [fetchPoll])

  useEffect(() => {
    if (poll?.settings.voteAccess === 'usersWithFullRights' && !userRestrictions) {
      api.user.refreshUserRestrictions()
    }
  }, [userRestrictions, api.user, poll?.settings.voteAccess])

  const handleOptionSelect = (optionId: string) => {
    if (!poll || isPollExpired || hasUserVoted) return

    const isMultipleVotesAllowed = poll.settings.allowMultipleChoice
    setSelectedOptions((prev) => {
      if (isMultipleVotesAllowed) {
        return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      } else {
        return [optionId]
      }
    })
  }

  const updatePoll = async () => {
    api.poll.invalidatePoll(pollId)
    const updatedPoll = await api.poll.getPollCached(pollId)
    setPoll(updatedPoll)
  }

  const handleSubmitVote = async () => {
    if (!poll || selectedOptions.length === 0 || isPollExpired || hasUserVoted) return

    try {
      await api.pollAPI.vote({
        pollId,
        optionIds: selectedOptions,
      })
      await updatePoll()
    } catch (err) {
      toast.error(`Не удалось проголосовать${err instanceof Error ? `: ${err.message}` : ''}`)
    }
  }

  const handleRescindVote = async () => {
    if (!poll || !poll.settings.allowVoteRescinding || isPollExpired) return

    try {
      await api.pollAPI.vote({ pollId, optionIds: [] })
      await updatePoll()
      setSelectedOptions([])
    } catch (err) {
      toast.error(`Не удалось отменить голос${err instanceof Error ? `: ${err.message}` : ''}`)
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
    const isMultipleVotesAllowed = poll?.settings.allowMultipleChoice
    const hasAnyVotes = (poll?.userVotes ?? []).length > 0

    const canShowResults = (() => {
      switch (poll?.settings.resultVisibility) {
        case 'always':
          return true
        case 'afterVote':
          return hasUserVoted
        case 'afterVoteEnd':
          return hasUserVoted && isPollExpired
        default:
          return false
      }
    })()

    return poll.options.map((option, idx) => {
      const optionId = String(idx)
      const percentage = calculatePercentage(option.votes)
      const isSelected = allowedToVote && selectedOptions.includes(optionId)
      const isDisabled = isPollExpired || hasUserVoted || (!isMultipleVotesAllowed && hasAnyVotes) || !allowedToVote

      return (
        <div
          key={`${optionId}-${poll.id}`}
          className={[styles.option, isSelected && styles.selected, isDisabled && styles.disabled]
            .filter(Boolean)
            .join(' ')}
          style={{ cursor: isDisabled ? 'default' : 'pointer' }}
          onClick={() => handleOptionSelect(optionId)}
        >
          <div className={styles.optionContent}>
            <div className={styles.optionSelect}>
              {isMultipleVotesAllowed ? (
                <Checkbox
                  id={`poll-option-${optionId}-${poll.id}`}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {}}
                />
              ) : (
                <Radio
                  id={`poll-option-${optionId}-${poll.id}`}
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
                    <VotersTooltip pollId={poll.id} optionId={optionId} votesCount={option.votes} />
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

    if (poll.expires) {
      return (
        <div className={styles.expiration}>
          <span>Окончание: </span>
          <DateComponent date={poll.expires} />
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
    if (isPollExpired) {
      return (
        <div className={styles.expiration}>
          <span>Опрос завершен</span>
        </div>
      )
    }
    if (!allowedToVote) {
      return (
        <div className={styles.expiration}>
          <span>Нет прав для голосования</span>
        </div>
      )
    }

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
          <Button variant='positive' onClick={handleSubmitVote} disabled={selectedOptions.length === 0}>
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
