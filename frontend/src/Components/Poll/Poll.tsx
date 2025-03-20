import React, { useEffect, useState } from 'react'

import PollService from '../../Services/PollService'
import { Poll as PollType } from '../../Types/Poll'

import styles from './Poll.module.css'

interface PollProps {
  pollId: string
  onVote?: (pollId: string, optionId: string) => void
}

export const Poll: React.FC<PollProps> = ({ pollId, onVote }) => {
  console.log('render Poll pollId', pollId)
  const [poll, setPoll] = useState<PollType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const fetchPoll = async () => {
    try {
      const pollData = await PollService.getPoll(pollId)
      console.log('pollData', pollData)
      setPoll(pollData)
      if (pollData.userVoted) {
        setSelectedOption(pollData.userVoted)
      }
    } catch (err) {
      setError('Не удалось загрузить опрос')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPoll()
  }, [pollId, selectedOption])

  const handleVote = async (optionId: string) => {
    if (!poll) return
    if (poll.userVoted !== undefined && !poll.settings.allowMultipleVotes) return

    try {
      const response = await PollService.vote({ poll_id: Number(pollId), option_ids: [Number(optionId)] })
      if (response) {
        const updatedPoll = await PollService.getPoll(pollId)
        setPoll(updatedPoll)
        setSelectedOption(optionId)
        if (onVote) {
          onVote(pollId, optionId)
        }
      }
    } catch (err) {
      setError('Не удалось отправить голос')
    }
  }

  const calculatePercentage = (votes: number) => {
    if (!poll || poll.totalVotes === 0) return 0
    return Math.round((votes / poll.totalVotes) * 100)
  }

  if (loading) return <div className={styles.loading}>Загрузка...</div>
  if (error) return <div className={styles.error}>{error}</div>
  if (!poll) return null

  const canVote = !poll.userVoted || poll.settings.allowMultipleVotes
  const showResults = poll.settings.showResults || poll.userVoted

  return (
    <div className={styles.pollContainer}>
      <h3 className={styles.question}>{poll.question}</h3>

      <div className={styles.options}>
        {poll.options.map((option, idx) => {
          const percentage = calculatePercentage(option.votes)
          const isSelected = String(idx) === selectedOption

          return (
            <div
              key={`${idx}-${poll.poll_id}`}
              className={`${styles.option} ${isSelected ? styles.selected : ''}`}
              onClick={() => canVote && handleVote(String(idx))}
              style={{ cursor: canVote ? 'pointer' : 'default' }}
            >
              <div className={styles.optionContent}>
                <span className={styles.optionText}>{option.text}</span>
                {showResults && (
                  <div className={styles.results}>
                    <div className={styles.progressBar} style={{ width: `${percentage}%` }} />
                    <span className={styles.percentage}>{percentage}%</span>
                    <span className={styles.votes}>
                      ({option.votes} {option.votes === 1 ? 'голос' : 'голосов'})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {poll.settings.expiresAt && (
        <div className={styles.expiration}>
          Опрос закончится: {new Date(poll.settings.expiresAt).toLocaleDateString()}
        </div>
      )}

      <div className={styles.totalVotes}>Всего голосов: {poll.totalVotes || 0}</div>
    </div>
  )
}
