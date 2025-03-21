import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { Logger } from 'winston'

import PollRepository from '../db/repositories/PollRepository'
import PollManager from '../managers/PollManager'
import UserManager from '../managers/UserManager'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { PollEntity } from './types/entities/PollEntity'
import { PollCreateRequest, PollCreateResponse } from './types/requests/PollCreate'
import { PollGetRequest, PollGetResponse, PollListRequest, PollListResponse } from './types/requests/PollGet'
import { PollVoteRequest, PollVoteResponse } from './types/requests/PollVote'

export interface PollBatchRequest {
  ids: number[]
}

export interface PollBatchResponse {
  polls: PollEntity[]
}

const MAX_VOTES_PER_MINUTE = 30
const MAX_POLLS_PER_MINUTE = 10

export default class PollController {
  public router = Router()
  private pollManager: PollManager
  private userManager: UserManager
  private logger: Logger
  private pollRepository: PollRepository

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

  constructor(
    pollManager: PollManager,
    userManager: UserManager,
    oauth: OAuth2MiddlewareGenerator,
    logger: Logger,
    pollRepository: PollRepository,
  ) {
    this.pollManager = pollManager
    this.userManager = userManager
    this.logger = logger
    this.pollRepository = pollRepository

    const createSchema = Joi.object<PollCreateRequest>({
      post_id: Joi.number().required(),
      question: Joi.string().required().max(1000),
      options: Joi.array().items(Joi.string().max(200)).min(2).max(32).required(),
      settings: Joi.object({
        allow_multiple_choice: Joi.boolean(),
        result_visibility: Joi.string().valid('always', 'after_vote', 'after_vote_end'),
        allow_vote_rescind: Joi.boolean(),
        vote_resctrictions: Joi.string().valid('everybody', 'users_with_full_rights'),
      }),
      expires_at: Joi.date().greater('now'),
    })

    const voteSchema = Joi.object<PollVoteRequest>({
      poll_id: Joi.number().required(),
      option_ids: Joi.array().items(Joi.number()).min(1).max(32).required(),
    })

    const getSchema = Joi.object<PollGetRequest>({
      poll_id: Joi.number().required(),
    })

    const listSchema = Joi.object<PollListRequest>({
      site_id: Joi.number().required(),
      limit: Joi.number().min(1).max(100),
      offset: Joi.number().min(0),
      active_only: Joi.boolean(),
    })

    const batchSchema = Joi.object<PollBatchRequest>({
      ids: Joi.array().items(Joi.number()).min(1).max(100).required(),
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

    this.router.get('/poll/:pollId', validate(getSchema), oauth('читать'), (req, res) => this.getPoll(req, res))

    this.router.get('/polls', validate(listSchema), oauth('читать'), (req, res) => this.getPolls(req, res))

    this.router.post('/polls/batch', validate(batchSchema), oauth('читать'), (req, res) => this.getPollsBatch(req, res))
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

      const siteResult = await this.pollRepository.getSiteIdFromPost(request.body.post_id)
      if (!siteResult) {
        throw new Error('Post not found')
      }

      const poll = await this.pollManager.createPoll(
        userId,
        siteResult.site_id,
        question,
        options,
        settings,
        expires_at,
      )

      this.logger.info(`User #${userId} created poll #${poll.poll_id}`, {
        user_id: userId,
        poll_id: poll.poll_id,
        site_id: siteResult.site_id,
      })

      response.success({ poll })
    } catch (err) {
      this.logger.error('Poll creation error', { error: err, user_id: userId })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async vote(request: APIRequest<PollVoteRequest>, response: APIResponse<PollVoteResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const userId = request.session.data.userId
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

  async getPoll(request: APIRequest<PollGetRequest>, response: APIResponse<PollGetResponse>) {
    const userId = request.session.data.userId
    const pollId = parseInt(request.params.pollId)

    try {
      const poll = await this.pollManager.getPoll(pollId, userId)
      if (!poll) {
        return response.error('not-found', 'Poll not found', 404)
      }

      response.success({ poll })
    } catch (err) {
      this.logger.error('Get poll error', { error: err, poll_id: pollId })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async getPolls(request: APIRequest<PollListRequest>, response: APIResponse<PollListResponse>) {
    const { site_id, limit, offset, active_only } = request.query

    try {
      const result = await this.pollManager.getPolls(
        parseInt(site_id as string),
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined,
        active_only === 'true',
      )

      response.success(result)
    } catch (err) {
      this.logger.error('Get polls error', { error: err, site_id })
      return response.error('error', 'Unknown error', 500)
    }
  }

  async getPollsBatch(request: APIRequest<PollBatchRequest>, response: APIResponse<PollBatchResponse>) {
    const userId = request.session.data.userId
    const { ids } = request.body

    try {
      const polls = await Promise.all(ids.map((id) => this.pollManager.getPoll(id, userId)))
      const validPolls = polls.filter((poll): poll is PollEntity => poll !== null)

      response.success({ polls: validPolls })
    } catch (err) {
      this.logger.error('Get polls batch error', { error: err, poll_ids: ids })
      return response.error('error', 'Unknown error', 500)
    }
  }
}
