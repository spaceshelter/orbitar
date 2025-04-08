import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { Logger } from 'winston'

import PollManager from '../managers/PollManager'
import UserManager from '../managers/UserManager'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { PollEntity } from './types/entities/PollEntity'
import { PollCreateRequest, PollCreateResponse } from './types/requests/PollCreate'
import { PollVoteRequest, PollVoteResponse } from './types/requests/PollVote'

export interface PollBatchRequest {
  ids: number[]
}

export interface PollBatchResponse {
  polls: PollEntity[]
}

export interface PollRescindVoteRequest {
  poll_id: number
}

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
      options: Joi.array().items(Joi.string().max(64)).min(2).max(32).required(),
      settings: Joi.object({
        allow_multiple_choice: Joi.boolean(),
        result_visibility: Joi.string().valid('always', 'after_vote', 'after_vote_end'),
        allow_vote_rescinding: Joi.boolean(),
        vote_access: Joi.string().valid('everybody', 'users_with_full_rights'),
      }),
      expires_at: Joi.date().greater('now'),
    })

    const voteSchema = Joi.object<PollVoteRequest>({
      poll_id: Joi.number().integer().required(),
      option_ids: Joi.array().items(Joi.number().integer().min(0).max(31)).min(1).max(32).required(),
    })

    const batchSchema = Joi.object<PollBatchRequest>({
      ids: Joi.array().items(Joi.number().integer()).min(1).max(256).required(),
    })

    const rescindSchema = Joi.object<PollRescindVoteRequest>({
      poll_id: Joi.number().integer().required(),
    })

    this.router.post(
      '/poll/create',
      this.createRateLimiter,
      validate(createSchema),
      oauth('создавать опросы'),
      (req, res) => this.createPoll(req, res),
    )

    this.router.post('/poll/vote', this.voteRateLimiter, validate(voteSchema), oauth('голосовать'), (req, res) =>
      this.vote(req, res),
    )

    this.router.post('/polls', validate(batchSchema), oauth('читать'), (req, res) => this.getPollsBatch(req, res))

    this.router.post('/poll/rescind', validate(rescindSchema), oauth('голосовать'), (req, res) =>
      this.rescindVote(req, res),
    )
  }

  async createPoll(request: APIRequest<PollCreateRequest>, response: APIResponse<PollCreateResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
    const { question, options, settings, expires_at } = request.body

    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (!restrictions.canCreatePolls) {
        throw new Error('You do not have permission to create polls')
      }

      const poll = await this.pollManager.createPoll(userId, question, options, settings, expires_at)

      this.logger.info(`User #${userId} created poll #${poll.poll_id}`, {
        user_id: userId,
        poll_id: poll.poll_id,
      })

      response.success({ poll })
    } catch (err) {
      this.logger.error('Poll creation error', { error: err, user_id: userId })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async vote(request: APIRequest<PollVoteRequest>, response: APIResponse<PollVoteResponse>) {
    const userId = request.session.data.userId
    if (!userId) {
      return response.authRequired()
    }

    const { poll_id, option_ids } = request.body

    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (!restrictions.canVote) {
        return response.error('cant-vote', 'Voting is disabled', 403)
      }

      const poll = await this.pollManager.vote(poll_id, userId, option_ids)

      this.logger.info(`User #${userId} voted in poll #${poll_id}`, {
        user_id: userId,
        poll_id,
        option_ids,
      })

      response.success({ poll })
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'Poll not found') {
          return response.error('not-found', 'Poll not found', 404)
        }
        if (err.message === 'Poll has expired') {
          return response.error('expired', 'Poll has expired', 403)
        }
        if (err.message === 'Multiple choice not allowed') {
          return response.error('multiple-choice-not-allowed', 'Multiple choice not allowed', 400)
        }
        if (err.message === 'Invalid option ID') {
          return response.error('invalid-option', 'Invalid option ID', 400)
        }
      }

      this.logger.error('Vote error', { error: err, user_id: userId, poll_id })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async getPollsBatch(request: APIRequest<PollBatchRequest>, response: APIResponse<PollBatchResponse>) {
    const { ids } = request.body

    const uniqueIds = [...new Set(ids)]

    try {
      const polls = await this.pollManager.getPollsBatch(uniqueIds)
      const validPolls = polls.filter((poll): poll is PollEntity => poll !== null)

      response.success({ polls: validPolls })
    } catch (err) {
      this.logger.error('Get polls batch error', { error: err, poll_ids: ids })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async rescindVote(request: APIRequest<{ poll_id: number }>, response: APIResponse<PollVoteResponse>) {
    const userId = request.session.data.userId
    if (!userId) {
      return response.authRequired()
    }

    const { poll_id } = request.body

    try {
      const restrictions = await this.userManager.getUserRestrictions(userId)
      if (!restrictions.canVote) {
        return response.error('cant-vote', 'Voting is disabled', 403)
      }

      const poll = await this.pollManager.rescindVote(poll_id, userId)

      this.logger.info(`User #${userId} rescinded vote in poll #${poll_id}`, {
        user_id: userId,
        poll_id,
      })

      response.success({ poll })
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'Poll not found') {
          return response.error('not-found', 'Poll not found', 404)
        }
        if (err.message === 'Poll has expired') {
          return response.error('expired', 'Poll has expired', 403)
        }
        if (err.message === 'Vote rescinding not allowed') {
          return response.error('rescind-not-allowed', 'Vote rescinding not allowed', 400)
        }
        if (err.message === 'No vote to rescind') {
          return response.error('no-vote', 'No vote to rescind', 400)
        }
      }

      this.logger.error('Vote rescind error', { error: err, user_id: userId, poll_id })
      return response.error('error', 'Unknown error', 500)
    }
  }
}
