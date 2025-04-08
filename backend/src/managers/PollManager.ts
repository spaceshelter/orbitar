import { RowDataPacket } from 'mysql2'

import { PollEntity, PollSettingsEntity } from '../api/types/entities/PollEntity'
import PollRepository from '../db/repositories/PollRepository'

interface PollRecord extends RowDataPacket {
  poll_id: number
  author_id: number
  question: string
  options: string
  settings: string
  expires_at: string | null
  created_at: string
  [key: `opt${number}`]: number
}

interface PollRecordParsed extends Omit<PollRecord, 'options' | 'settings'> {
  options: string[]
  settings: PollSettingsEntity
}

export default class PollManager {
  private pollRepository: PollRepository

  constructor(pollRepository: PollRepository) {
    this.pollRepository = pollRepository
  }

  private async getPollWithVotes(pollId: number, userId?: number): Promise<PollEntity | null> {
    const poll = await this.pollRepository.getPoll(pollId)
    if (!poll) {
      return null
    }

    const parsedPoll = poll as unknown as PollRecordParsed
    const options = parsedPoll.options
    const settings = parsedPoll.settings
    const userVotes = userId ? await this.pollRepository.getUserVotes(pollId, userId) : undefined

    const totalVotes = Array.from({ length: 32 }, (_, i) => poll[`opt${i}`] || 0).reduce((sum, count) => sum + count, 0)

    const optionsWithVoters = await Promise.all(
      options.map(async (text: string, index: number) => {
        const voters = await this.pollRepository.getOptionVoters(pollId, index)
        return {
          text,
          votes: poll[`opt${index}`] || 0,
          voters,
        }
      }),
    )

    return {
      poll_id: poll.poll_id,
      author_id: poll.author_id,
      question: poll.question,
      options: optionsWithVoters,
      settings,
      expires_at: poll.expires_at,
      created_at: poll.created_at,
      total_votes: totalVotes,
      user_vote: userVotes,
    }
  }

  async createPoll(
    authorId: number,
    question: string,
    options: string[],
    settings: PollSettingsEntity,
    expiresAt?: string,
  ): Promise<PollEntity> {
    if (options.length < 2 || options.length > 32) {
      throw new Error('Invalid number of options')
    }
    const result = await this.pollRepository.createPoll(authorId, question, options, settings, expiresAt)

    const pollId = (result as RowDataPacket).insertId
    const poll = await this.getPollWithVotes(pollId)
    if (!poll) throw new Error('Failed to create poll')
    return poll
  }

  async vote(pollId: number, voterId: number, optionIds: number[]): Promise<PollEntity> {
    const poll = await this.getPollWithVotes(pollId)
    if (!poll) {
      throw new Error('Poll not found')
    }

    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      throw new Error('Poll has expired')
    }

    const settings = poll.settings
    if (!settings.allow_multiple_choice && optionIds.length > 1) {
      throw new Error('Multiple choice not allowed')
    }

    if (optionIds.some((id) => id < 0 || id >= poll.options.length)) {
      throw new Error('Invalid option ID')
    }

    const previousVotes = await this.pollRepository.getUserVotes(pollId, voterId)
    if (previousVotes.length > 0) {
      if (!settings.allow_multiple_choice) {
        if (!settings.allow_vote_rescinding) {
          throw new Error('Vote rescinding not allowed')
        }
        await this.pollRepository.removeVotes(pollId, voterId, previousVotes)
      }
    }

    for (const optionId of optionIds) {
      await this.pollRepository.vote(pollId, voterId, optionId)
    }

    return await this.getPollWithVotes(pollId, voterId)
  }

  async rescindVote(pollId: number, voterId: number): Promise<PollEntity> {
    const poll = await this.getPollWithVotes(pollId)
    if (!poll) {
      throw new Error('Poll not found')
    }

    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      throw new Error('Poll has expired')
    }

    if (!poll.settings.allow_vote_rescinding) {
      throw new Error('Vote rescinding not allowed')
    }

    const previousVotes = await this.pollRepository.getUserVotes(pollId, voterId)
    if (previousVotes.length === 0) {
      throw new Error('No vote to rescind')
    }

    await this.pollRepository.removeVotes(pollId, voterId, previousVotes)

    return await this.getPollWithVotes(pollId, voterId)
  }

  async getPoll(pollId: number, userId?: number): Promise<PollEntity | null> {
    return await this.getPollWithVotes(pollId, userId)
  }

  async getPolls(limit = 20, offset = 0, activeOnly = false): Promise<{ polls: PollEntity[]; total: number }> {
    const result = await this.pollRepository.getPolls(limit, offset, activeOnly)
    const polls = Array.isArray(result.polls) ? result.polls : []

    return {
      polls: polls.map((poll: PollRecord) => {
        const parsedPoll = poll as unknown as PollRecordParsed
        const options = parsedPoll.options
        const settings = parsedPoll.settings
        return {
          poll_id: poll.poll_id,
          author_id: poll.author_id,
          question: poll.question,
          options: options.map((text: string, index: number) => ({
            text,
            votes: poll[`opt${index}`] || 0,
          })),
          settings,
          expires_at: poll.expires_at,
          created_at: poll.created_at,
          total_votes: Array.from({ length: 32 }, (_, i) => poll[`opt${i}`] || 0).reduce(
            (sum, count) => sum + count,
            0,
          ),
        }
      }),
      total: result.total,
    }
  }
}
