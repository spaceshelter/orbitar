import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { Logger } from 'winston'

import PollManager, { IncludePollVotes, PollError } from '../managers/PollManager'
import UserManager from '../managers/UserManager'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { ResultVisibility, VoteAccess } from './types/entities/PollEntity'
import {
  PollBatchRequest,
  PollBatchResponse,
  PollCreateRequest,
  PollCreateResponse,
  PollVoteRequest,
  PollVoteResponse,
  PollVotersRequest,
  PollVotersResponse,
} from './types/requests/Poll'

const MAX_VOTES_PER_MINUTE = 30
const MAX_POLLS_PER_MINUTE = 10

export default class PollController {
  public router = Router()
  private pollManager: PollManager
  private userManager: UserManager
  private logger: Logger

  // 30 requests per minute for voting
  private readonly voteRateLimiter = rateLimit({
    max: MAX_VOTES_PER_MINUTE,
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.session.data?.userId),
  })

  // 10 requests per minute for creating polls
  private readonly createRateLimiter = rateLimit({
    max: MAX_POLLS_PER_MINUTE,
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.session.data?.userId),
  })

  constructor(pollManager: PollManager, userManager: UserManager, oauth: OAuth2MiddlewareGenerator, logger: Logger) {
    this.pollManager = pollManager
    this.userManager = userManager
    this.logger = logger

    const createSchema = Joi.object<PollCreateRequest>({
      question: Joi.string().required().max(1000),
      options: Joi.array().items(Joi.string().min(1).max(64)).min(2).max(32).required(),
      settings: Joi.object({
        allowMultipleChoice: Joi.boolean(),
        resultVisibility: Joi.string().valid(...Object.values(ResultVisibility)),
        allowVoteRescinding: Joi.boolean(),
        voteAccess: Joi.string().valid(...Object.values(VoteAccess)),
      }),
      expires: Joi.date().greater('now'),
    })

    const batchSchema = Joi.object<PollBatchRequest>({
      ids: Joi.array().items(Joi.number().integer()).min(1).max(256).required(),
    })

    const voteSchema = Joi.object<PollVoteRequest>({
      pollId: Joi.number().integer().required(),
      optionIds: Joi.array().items(Joi.number().integer().min(0).max(31)).min(0).max(32).required(),
    })

    const votersSchema = Joi.object<PollVotersRequest>({
      pollId: Joi.number().integer().required(),
      optionId: Joi.number().integer().min(0).max(31).required(),
    })

    this.router.post(
      '/poll/create',
      this.createRateLimiter,
      validate(createSchema),
      oauth('создавать опросы'),
      (req, res) => this.createPoll(req, res),
    )

    this.router.post('/poll/get', validate(batchSchema), oauth('получать cписок опросов'), (req, res) =>
      this.getPolls(req, res),
    )

    this.router.post(
      '/poll/vote',
      this.voteRateLimiter,
      validate(voteSchema),
      oauth('голосовать в опросе'),
      (req, res) => this.vote(req, res),
    )

    this.router.post(
      '/poll/voters',
      validate(votersSchema),
      oauth('получать список пользователей, проголосовавших за определенный вариант опроса'),
      (req, res) => this.getVoters(req, res),
    )
  }

  async createPoll(request: APIRequest<PollCreateRequest>, response: APIResponse<PollCreateResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { question, options, settings, expires } = request.body

    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (!restrictions.canCreatePolls) {
        return response.error('permission-denied', 'You do not have permission to create polls', 403)
      }

      if (settings.allowVoteRescinding && settings.resultVisibility === ResultVisibility.AFTER_VOTE) {
        return response.error('invalid-settings', 'after_vote result visibility is not allowed with rescind vote', 400)
      }

      if (!expires && settings.resultVisibility === ResultVisibility.AFTER_VOTE_END) {
        return response.error('invalid-settings', 'after_vote_end result visibility requires expiration date', 400)
      }

      const pollId = await this.pollManager.createPoll(
        userId,
        question,
        options,
        settings,
        expires ? new Date(expires) : null,
      )

      this.logger.info(`User #${userId} created poll #${pollId}`, {
        user_id: userId,
        poll_id: pollId,
      })

      response.success({ id: pollId })
    } catch (err) {
      if (err instanceof PollError) {
        return response.error(err.code, err.message, err.status)
      }

      this.logger.error('Poll creation error', { error: err, user_id: userId })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async getPolls(request: APIRequest<PollBatchRequest>, response: APIResponse<PollBatchResponse>) {
    const { ids } = request.body
    const userId = request.session.data.userId
    const uniqueIds = [...new Set(ids)]

    try {
      const polls = await this.pollManager.getPollsByIds(uniqueIds, userId, IncludePollVotes.AUTO)
      response.success({ polls })
    } catch (err) {
      if (err instanceof PollError) {
        return response.error(err.code, err.message, err.status)
      }

      this.logger.error('Get polls error', { error: err, poll_ids: ids })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async vote(request: APIRequest<PollVoteRequest>, response: APIResponse<PollVoteResponse>) {
    const userId = request.session.data.userId
    if (!userId) {
      return response.authRequired()
    }

    const { pollId, optionIds } = request.body

    try {
      await this.pollManager.vote(pollId, userId, optionIds)

      const [poll] = await this.pollManager.getPollsByIds([pollId], userId, IncludePollVotes.AUTO)

      this.logger.info(`User #${userId} voted in poll #${pollId}`, {
        userId,
        pollId,
      })

      response.success({ poll })
    } catch (err) {
      if (err instanceof PollError) {
        return response.error(err.code, err.message, err.status)
      }

      this.logger.error('Vote error', { error: err, user_id: userId, pollId })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async getVoters(request: APIRequest<PollVotersRequest>, response: APIResponse<PollVotersResponse>) {
    const { pollId, optionId } = request.body
    const userId = request.session.data.userId
    if (!userId) {
      return response.authRequired()
    }

    try {
      const voters = await this.pollManager.getVoters(pollId, optionId)
      response.success({ voters })
    } catch (err) {
      if (err instanceof PollError) {
        return response.error(err.code, err.message, err.status)
      }

      this.logger.error('Get voters error', { error: err, userId, pollId })
      return response.error('error', 'Unknown error', 500)
    }
  }
}
