import { Router } from 'express'
import Joi from 'joi'
import { Logger } from 'winston'

import EncryptedPayloadManager from '../managers/EncryptedPayloadManager'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { EncryptedPayloadBatchRequest, EncryptedPayloadBatchResponse } from './types/requests/EncryptedPayload'

export default class EncryptedPayloadController {
  public readonly router = Router()
  private readonly encryptedPayloadManager: EncryptedPayloadManager
  private readonly logger: Logger

  constructor(encryptedPayloadManager: EncryptedPayloadManager, oauth: OAuth2MiddlewareGenerator, logger: Logger) {
    this.encryptedPayloadManager = encryptedPayloadManager
    this.logger = logger

    const batchSchema = Joi.object<EncryptedPayloadBatchRequest>({
      ids: Joi.array().items(Joi.number().integer()).min(1).max(256).required(),
    })

    this.router.post('/encrypted-payload/get', validate(batchSchema), oauth('читать шифрованный контент'), (req, res) =>
      this.getPayloads(req, res),
    )
  }

  async getPayloads(
    request: APIRequest<EncryptedPayloadBatchRequest>,
    response: APIResponse<EncryptedPayloadBatchResponse>,
  ) {
    const userId = request.session.data.userId
    if (!userId) {
      return response.authRequired()
    }

    try {
      const payloads = await this.encryptedPayloadManager.getEncryptedPayloadsByIds(
        [...new Set(request.body.ids)],
        userId,
      )
      return response.success({ payloads })
    } catch (error) {
      this.logger.error('Get encrypted payloads error', { error, payloadIds: request.body.ids, userId })
      return response.error('error', 'Unknown error', 500)
    }
  }
}
