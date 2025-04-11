import { ResultVisibility } from '../api/types/entities/PollEntity'
import PollRepository from '../db/repositories/PollRepository'
import { PollRaw } from '../db/types/PollRaw'
import { PollInfo, PollSettingsInfo } from './types/PollInfo'
import { UserBaseInfo } from './types/UserInfo'
import UserManager from './UserManager'

export enum IncludePollVotes {
  YES = 'yes',
  NO = 'no',
  AUTO = 'auto',
}

export class PollError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'PollError'
  }
}

export default class PollManager {
  private pollRepository: PollRepository
  private userManager: UserManager

  constructor(pollRepository: PollRepository, userManager: UserManager) {
    this.pollRepository = pollRepository
    this.userManager = userManager
  }

  async createPoll(
    authorId: number,
    question: string,
    options: string[],
    settings: PollSettingsInfo,
    expiresAt?: Date,
  ): Promise<number> {
    if (options.length < 2 || options.length > 32) {
      throw new PollError('invalid-options', 'Invalid number of options', 400)
    }
    const pollId = await this.pollRepository.createPoll(authorId, question, options, settings, expiresAt)

    if (!pollId) throw new PollError('creation-failed', 'Failed to create poll', 500)
    return pollId
  }

  enrichPoll(poll: PollRaw, includeVotes = true, userVotes?: number[]): PollInfo {
    return {
      id: String(poll.poll_id),
      author: String(poll.author_id),
      question: poll.question,
      settings: poll.settings,
      expires: poll.expires_at,
      created: poll.created_at,
      options: poll.options.map((text: string, index: number) => ({
        text,
        votes: (includeVotes && poll[`opt${index}`]) || 0,
      })),
      totalVotes:
        (includeVotes &&
          Array.from({ length: 32 }, (_, i) => poll[`opt${i}`] || 0).reduce((sum, count) => sum + count, 0)) ||
        0,
      userVotes: userVotes?.map(String),
    }
  }

  async getPollsByIds(ids: number[], userId?: number, includeVotes = IncludePollVotes.NO): Promise<PollInfo[]> {
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
          (poll.settings.resultVisibility === ResultVisibility.ALWAYS ||
            (poll.settings.resultVisibility === ResultVisibility.AFTER_VOTE && userVotesForPoll.length > 0) ||
            (poll.settings.resultVisibility === ResultVisibility.AFTER_VOTE_END &&
              (!poll.expires_at || new Date(poll.expires_at) < new Date()))))

      return this.enrichPoll(poll, includeVotesForPoll, userVotesForPoll)
    })
  }

  async vote(pollId: number, voterId: number, optionIds: number[]) {
    const [poll] = await this.getPollsByIds([pollId])
    if (!poll) {
      throw new PollError('not-found', 'Poll not found', 404)
    }

    if (poll.expires && new Date(poll.expires) < new Date()) {
      throw new PollError('expired', 'Poll has expired', 403)
    }

    const settings = poll.settings
    if (!settings.allowMultipleChoice && optionIds.length > 1) {
      throw new PollError('multiple-choice-not-allowed', 'Multiple choice not allowed', 400)
    }

    if (optionIds.length === 0 && !settings.allowVoteRescinding) {
      throw new PollError('rescind-not-allowed', 'Vote rescinding not allowed', 400)
    }

    if (optionIds.some((id) => id < 0 || id >= poll.options.length)) {
      throw new PollError('invalid-option', 'Invalid option ID', 400)
    }

    if (
      settings.voteAccess === 'usersWithFullRights' &&
      !(await this.userManager.getUserRestrictions(voterId)).canVoteKarma /*proxy for full rights*/
    ) {
      throw new PollError('permission-denied', 'You do not have permission to vote', 403)
    }

    await this.pollRepository.vote(pollId, voterId, optionIds)
  }

  async getVoters(pollId: number, optionId: number): Promise<UserBaseInfo[]> {
    if (optionId < 0 || optionId >= 32) {
      throw new PollError('invalid-option', 'Invalid option ID', 400)
    }

    const [poll] = await this.getPollsByIds([pollId])
    if (!poll) {
      throw new PollError('not-found', 'Poll not found', 404)
    }

    if (
      poll.settings.resultVisibility === ResultVisibility.AFTER_VOTE_END &&
      poll.expires &&
      new Date(poll.expires) > new Date()
    ) {
      throw new PollError('poll-active', 'Poll has not ended yet', 403)
    }

    return await this.pollRepository.getVoters(pollId, optionId)
  }
}
