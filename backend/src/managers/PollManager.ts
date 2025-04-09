import { PollEntity, PollSettingsEntity } from '../api/types/entities/PollEntity'
import PollRepository from '../db/repositories/PollRepository'
import { UserBaseInfo } from './types/UserInfo'

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

  async getPollsBatch(ids: number[], userId?: number): Promise<PollEntity[]> {
    const result = await this.pollRepository.getPollsBatch(ids, userId)
    const polls = Array.isArray(result) ? result : []

    const res: PollEntity[] = []
    const pollMap: Record<number, PollEntity> = {}

    polls.forEach((poll) => {
      const { poll_id, author_id, question, options, settings, expires_at, created_at, user_voted_option_id } = poll
      if (!pollMap[poll_id]) {
        pollMap[poll_id] = {
          poll_id,
          author_id,
          question,
          options: options.map((text: string, index: number) => ({
            text,
            votes: poll[`opt${index}`] || 0,
          })),
          settings,
          expires_at,
          created_at,
          total_votes: Array.from({ length: 32 }, (_, i) => poll[`opt${i}`] || 0).reduce(
            (sum, count) => sum + count,
            0,
          ),
          user_vote: [],
        }

        res.push(pollMap[poll_id])
      }

      if (user_voted_option_id !== null) {
        pollMap[poll_id].user_vote?.push(user_voted_option_id)
      }
    })

    return res
  }

  async vote(pollId: number, voterId: number, optionIds: number[]): Promise<string> {
    const polls = await this.getPollsBatch([pollId], voterId)
    if (!polls.length) {
      throw new Error('Poll not found')
    }

    const poll = polls[0]
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

    const polls = await this.getPollsBatch([pollId])
    if (!polls.length) {
      throw new Error('Poll not found')
    }

    const poll = polls[0]
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
