import { Router } from 'express'
import { RedisClientType } from 'redis'
import { Logger } from 'winston'

import SiteManager from '../managers/SiteManager'
import UserManager from '../managers/UserManager'
import { APIRequest, APIResponse } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'
import { StatusRequest, StatusResponse } from './types/requests/Status'
import { Enricher } from './utils/Enricher'

const ONLINE_USERS_KEY = 'online_users'
const ONLINE_WINDOW_SECONDS = 90 // 3 × 30s polling interval

export default class StatusController {
  public readonly router = Router()
  private readonly siteManager: SiteManager
  private readonly userManager: UserManager
  private readonly logger: Logger
  private readonly enricher: Enricher
  private readonly redis: RedisClientType

  constructor(
    enricher: Enricher,
    siteManager: SiteManager,
    userManager: UserManager,
    oauth: OAuth2MiddlewareGenerator,
    logger: Logger,
    redis: RedisClientType,
  ) {
    this.siteManager = siteManager
    this.userManager = userManager
    this.enricher = enricher
    this.logger = logger
    this.redis = redis
    this.router.post('/status', oauth('читать статус'), (req, res) => this.status(req, res))
  }

  async status(request: APIRequest<StatusRequest>, response: APIResponse<StatusResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired()
    }

    try {
      const userId = request.session.data.userId
      const user = await this.userManager.getById(userId)
      const stats = await this.userManager.getUserStats(userId)

      if (!user) {
        // Something wrong, user should exist!
        return response.error('error', 'Unknown error', 500)
      }

      // track online users via Redis sorted set (score = unix timestamp)
      const now = Math.floor(Date.now() / 1000)
      await this.redis.zAdd(ONLINE_USERS_KEY, { score: now, value: String(userId) })
      const onlineCount = await this.redis.zCount(ONLINE_USERS_KEY, now - ONLINE_WINDOW_SECONDS, '+inf')

      return response.success({
        user,
        ...stats,
        onlineCount,
      })
    } catch (err) {
      this.logger.error(err)
      return response.error('error', 'Unknown error', 500)
    }
  }
}
