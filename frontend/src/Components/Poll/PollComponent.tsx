import React, { useCallback, useEffect, useState } from 'react'

import { PollEntity, ResultVisibility, VoteAccess } from '@api/types/Poll'
import DateComponent from '@components/DateComponent'
import { VotersTooltip } from '@components/Poll/VotersList'
import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import Radio from '@ui/Radio'
import { pluralize } from '@utils/utils'
import { FaSyncAlt } from 'react-icons/fa'
import { toast } from 'react-toastify'

import styles from './PollComponent.module.scss'

interface PollProps {
  pollId: number
}

export const PollComponent: React.FC<PollProps> = ({ pollId }) => {
  const api = useAPI()
  const [poll, setPoll] = useState<PollEntity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const { userRestrictions } = useAppState()

  const hasUserVoted = (poll?.userVotes ?? []).length > 0
  const isPollExpired = poll?.expires && poll.expires < new Date()
  const allowedToVote =
    (poll?.settings.voteAccess !== VoteAccess.USERS_WITH_FULL_RIGHTS || userRestrictions?.canVoteKarma) &&
    userRestrictions?.canVote

  const fetchPoll = useCallback(
    async (force = false) => {
      setError(null)

      try {
        if (force) {
          api.poll.invalidatePoll(pollId)
        }
        const pollData = await api.poll.getPollCached(pollId)
        setPoll(pollData)
        setSelectedOptions(pollData.userVotes || [])
      } catch (err) {
        setError('Не удалось загрузить опрос')
      }
    },
    [pollId, api.poll],
  )

  useEffect(() => {
    fetchPoll()
  }, [fetchPoll])

  useEffect(() => {
    if (!userRestrictions) {
      api.user.refreshUserRestrictions()
    }
  }, [userRestrictions, api.user])

  // if expiration date is in the future, schedule a refresh
  useEffect(() => {
    if (poll && poll?.expires && poll.expires > new Date()) {
      const refreshTimer = setTimeout(
        () => {
          fetchPoll(true)
        },
        Math.max(0, poll.expires.getTime() - Date.now() + 1000),
      )
      return () => clearTimeout(refreshTimer)
    }
  }, [poll])

  const handleOptionSelect = (optionId: number) => {
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

  const updatePoll = async (updatedPoll: PollEntity) => {
    setPoll(updatedPoll)
    api.poll.invalidatePoll(pollId)
  }

  const handleSubmitVote = async () => {
    if (!poll || selectedOptions.length === 0 || isPollExpired || hasUserVoted) return

    try {
      const updatedPoll = await api.pollAPI.vote({
        pollId,
        optionIds: selectedOptions,
      })
      await updatePoll(updatedPoll.poll)
    } catch (err) {
      toast.error(`Не удалось проголосовать${err instanceof Error ? `: ${err.message}` : ''}`)
    }
  }

  const handleRescindVote = async () => {
    if (!poll || !poll.settings.allowVoteRescinding || isPollExpired) return

    try {
      const updatedPoll = await api.pollAPI.vote({ pollId, optionIds: [] })
      await updatePoll(updatedPoll.poll)
      setSelectedOptions([])
    } catch (err) {
      toast.error(`Не удалось отменить голос${err instanceof Error ? `: ${err.message}` : ''}`)
    }
  }

  const calculatePercentage = (votes: number) => {
    if (!poll || poll.totalVotes === 0) return 0
    return Math.round((votes / poll.totalVotes) * 100)
  }

  if (error) {
    return <div className={styles.error}>{error}</div>
  }
  if (!poll) return <div className={styles.loading}>Загрузка...</div>

  const canShowResults = (() => {
    switch (poll?.settings.resultVisibility) {
      case ResultVisibility.ALWAYS:
        return true
      case ResultVisibility.AFTER_VOTE:
        return hasUserVoted
      case ResultVisibility.AFTER_VOTE_END:
        return hasUserVoted && isPollExpired
      default:
        return false
    }
  })()

  const renderOptions = () => {
    const isMultipleVotesAllowed = poll?.settings.allowMultipleChoice
    const hasAnyVotes = (poll?.userVotes ?? []).length > 0

    return poll.options.map((option, optionId) => {
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
            <span className={styles.optionText} title={option.text}>
              {option.text}
            </span>
            <div className={styles.votesContainer}>
              {canShowResults && (
                <span className={styles.votes}>
                  <VotersTooltip
                    pollId={poll.id}
                    optionId={optionId}
                    votesCount={option.votes}
                    percentage={canShowResults ? percentage : undefined}
                    onClick={() => fetchPoll(true)}
                  />
                </span>
              )}
            </div>
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
          <span>завершение: </span>
          <span>&nbsp;</span>
          <span>
            <DateComponent date={poll.expires} />
          </span>
        </div>
      )
    }
  }

  const renderTotalVotes = () => {
    return (
      <div className={styles.totalVotes}>
        {(poll.totalVotes && pluralize(poll.totalVotes || 0, ['голос', 'голоса', 'голосов']) + ' всего') || ''}
        {(canShowResults && !(poll.expires && poll.expires < new Date()) && (
          <button
            className={styles.refreshButton}
            onClick={(e) => {
              e.stopPropagation()
              fetchPoll(true)
            }}
            title='Обновить результаты'
          >
            <FaSyncAlt size={14} />
          </button>
        )) ||
          ''}
        {(!canShowResults &&
          ((poll.settings.resultVisibility === ResultVisibility.AFTER_VOTE && 'результаты после ответа') ||
            (poll.settings.resultVisibility === ResultVisibility.AFTER_VOTE_END && 'результаты после завершения'))) ||
          ''}
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
      <span className={styles.question}>{poll.question}</span>

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
