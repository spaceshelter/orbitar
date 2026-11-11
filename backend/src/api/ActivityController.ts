import { Router } from 'express'
import Joi from 'joi'
import { Logger } from 'winston'

import ActivityManager from '../managers/ActivityManager'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { ActivityFeedRequest, ActivityFeedResponse } from './types/requests/ActivityFeed'

export default class ActivityController {
  public readonly router = Router()
  private readonly activityManager: ActivityManager
  private readonly logger: Logger

  constructor(activityManager: ActivityManager, oauth: OAuth2MiddlewareGenerator, logger: Logger) {
    this.activityManager = activityManager
    this.logger = logger

    const activityFeedSchema = Joi.object<ActivityFeedRequest>({
      after_id: Joi.number().integer().optional(),
      limit: Joi.number().integer().min(1).max(100).default(100),
    })

    this.router.post('/feed/activity', oauth('чтение ленты активности'), validate(activityFeedSchema), (req, res) =>
      this.getActivity(req, res),
    )
  }

  async getActivity(request: APIRequest<ActivityFeedRequest>, response: APIResponse<ActivityFeedResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    const { after_id: afterId, limit } = request.body

    try {
      const result = await this.activityManager.getPage(afterId, limit)
      response.success(result)
    } catch (err) {
      this.logger.error('Activity feed error', { error: err, after_id: afterId, limit })
      return response.error('error', 'Unknown error', 500)
    }
  }
}
