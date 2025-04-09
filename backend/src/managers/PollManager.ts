import { PollEntity, PollSettingsEntity } from '../api/types/entities/PollEntity'
import PollRepository from '../db/repositories/PollRepository'
import { PollRaw } from '../db/types/PollRaw'
import { UserBaseInfo } from './types/UserInfo'

export enum IncludePollVotes {
  YES = 'yes',
  NO = 'no',
  AUTO = 'auto',
}

export default class PollManager {
  private pollRepository: PollRepository

  constructor(pollRepository: PollRepository) {
    this.pollRepository = pollRepository
  }

  async createPoll(
    authorId: number,
    question: string,
    options: string[],
    settings: PollSettingsEntity,
    expiresAt?: string,
  ): Promise<number> {
    if (options.length < 2 || options.length > 32) {
      throw new Error('Invalid number of options')
    }
    const pollId = await this.pollRepository.createPoll(authorId, question, options, settings, expiresAt)

    if (!pollId) throw new Error('Failed to create poll')
    return pollId
  }

  enrichPoll(poll: PollRaw, includeVotes = true, userVotes?: number[]): PollEntity {
    return {
      poll_id: poll.poll_id,
      author_id: poll.author_id,
      question: poll.question,
      settings: poll.settings,
      expires_at: poll.expires_at,
      created_at: poll.created_at,
      options: poll.options.map((text: string, index: number) => ({
        text,
        votes: (includeVotes && poll[`opt${index}`]) || 0,
      })),
      total_votes:
        (includeVotes &&
          Array.from({ length: 32 }, (_, i) => poll[`opt${i}`] || 0).reduce((sum, count) => sum + count, 0)) ||
        0,
      user_vote: userVotes,
    }
  }

  async getPollsByIds(ids: number[], userId?: number, includeVotes = IncludePollVotes.NO): Promise<PollEntity[]> {
    const polls = await this.pollRepository.getPollsByIds(ids)

    const userVotes = new Map<number, number[]>()
    if (userId) {
      const votes = await this.pollRepository.getVotesBatch(userId, ids)
      votes.forEach((vote) => {
        if (!userVotes.has(vote.poll_id)) {
          userVotes.set(vote.poll_id, [])
        }
        userVotes.get(vote.poll_id)?.push(vote.option_id)
      })
    }

    return polls.map((poll) => {
      const userVotesForPoll = (userId && userVotes.get(poll.poll_id)) || []

      const includeVotesForPoll =
        includeVotes === IncludePollVotes.YES ||
        (includeVotes === IncludePollVotes.AUTO &&
          (poll.settings.result_visibility === 'always' ||
            (poll.settings.result_visibility === 'after_vote' && userVotesForPoll.length > 0) ||
            (poll.settings.result_visibility === 'after_vote_end' &&
              (!poll.expires_at || new Date(poll.expires_at) < new Date()))))

      return this.enrichPoll(poll, includeVotesForPoll, userVotesForPoll)
    })
  }

  async vote(pollId: number, voterId: number, optionIds: number[]): Promise<string> {
    const [poll] = await this.getPollsByIds([pollId])
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

    if (optionIds.length === 0 && !settings.allow_vote_rescinding) {
      throw new Error('Vote rescinding not allowed')
    }

    if (optionIds.some((id) => id < 0 || id >= poll.options.length)) {
      throw new Error('Invalid option ID')
    }
    await this.pollRepository.vote(pollId, voterId, optionIds)

    return 'voted'
  }

  async getVoters(pollId: number, optionId: number): Promise<UserBaseInfo[]> {
    if (optionId < 0 || optionId >= 32) {
      throw new Error('Invalid option ID')
    }

    const [poll] = await this.getPollsByIds([pollId])
    if (!poll) {
      throw new Error('Poll not found')
    }

    if (
      poll.settings.result_visibility === 'after_vote_end' &&
      poll.expires_at &&
      new Date(poll.expires_at) > new Date()
    ) {
      throw new Error('Poll has not ended yet')
    }

    return await this.pollRepository.getVoters(pollId, optionId)
  }
}
