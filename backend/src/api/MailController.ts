import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { Logger } from 'winston'

import MailManager from '../managers/MailManager'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { MailBatchEntity } from './types/entities/MailEntity'
import { MailBatchRequest, MailBatchResponse, MailCreateRequest, MailCreateResponse } from './types/requests/Mail'

const CREATE_RATE_LIMIT = 30
const BATCH_RATE_LIMIT = 120

export default class MailController {
  public router = Router()
  private mailManager: MailManager
  private logger: Logger

  private readonly createRateLimiter = rateLimit({
    max: CREATE_RATE_LIMIT,
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.session.data?.userId),
  })

  private readonly batchRateLimiter = rateLimit({
    max: BATCH_RATE_LIMIT,
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.session.data?.userId),
  })

  constructor(mailManager: MailManager, oauth: OAuth2MiddlewareGenerator, logger: Logger) {
    this.mailManager = mailManager
    this.logger = logger

    const createSchema = Joi.object<MailCreateRequest>({
      toUserId: Joi.number().integer(),
      toPublicKey: Joi.string().max(128),
      v: Joi.number().integer().min(1).max(255).required(),
      toPayload: Joi.string().required().max(65535),
      fromPayload: Joi.string().allow('').max(65535),
    }).xor('toUserId', 'toPublicKey')

    const batchSchema = Joi.object<MailBatchRequest>({
      ids: Joi.array().items(Joi.number().integer()).min(1).max(256).required(),
    })

    this.router.post(
      '/mail/create',
      this.createRateLimiter,
      validate(createSchema),
      oauth('создавать шифровки'),
      (req, res) => this.createMail(req, res),
    )

    this.router.post(
      '/mail/get',
      this.batchRateLimiter,
      validate(batchSchema),
      oauth('получать шифровки'),
      (req, res) => this.getMails(req, res),
    )
  }

  private async createMail(request: APIRequest<MailCreateRequest>, response: APIResponse<MailCreateResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    try {
      const id = await this.mailManager.createMail(
        request.session.data.userId,
        request.body.toUserId,
        request.body.toPublicKey,
        request.body.v,
        request.body.toPayload,
        request.body.fromPayload || undefined,
      )
      return response.success({ id })
    } catch (error) {
      if (error instanceof Error && error.message === 'Recipient not found') {
        return response.error('recipient-not-found', 'Recipient mailbox not found', 404)
      }
      this.logger.error('Could not create mail', { error, userId: request.session.data.userId })
      return response.error('error', 'Could not create mail', 500)
    }
  }

  private async getMails(request: APIRequest<MailBatchRequest>, response: APIResponse<MailBatchResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    try {
      const mails: MailBatchEntity[] = await this.mailManager.getMailsByIds(
        request.body.ids,
        request.session.data.userId,
      )
      return response.success({ mails })
    } catch (error) {
      this.logger.error('Could not get mails', { error, userId: request.session.data.userId })
      return response.error('error', 'Could not get mails', 500)
    }
  }
}
