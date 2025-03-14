import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { Logger } from 'winston'

import CodeError from '../CodeError'
import { MarkerManager } from '../managers/MarkerManager'
import { MarkerTargetType, MarkerType } from '../managers/types/MarkerInfo'
import { APIRequest, APIResponse, validate } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'

// Define common rate limit configuration
const commonRateLimitConfig = {
  skipSuccessfulRequests: false,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.session.data?.userId || req.ip),
}

export class MarkerController {
  public readonly router = Router()
  private markerManager: MarkerManager
  private logger: Logger | undefined

  // Define rate limiters for marker operations
  private readonly markerCreateRateLimiter = rateLimit({
    max: 20,
    windowMs: 60 * 1000, // 1 minute
    ...commonRateLimitConfig,
  })

  private readonly markerRemoveRateLimiter = rateLimit({
    max: 20,
    windowMs: 60 * 1000, // 1 minute
    ...commonRateLimitConfig,
  })

  constructor(markerManager: MarkerManager, oauth?: OAuth2MiddlewareGenerator, logger?: Logger) {
    this.markerManager = markerManager
    this.logger = logger

    // Define Joi schemas for validation
    const getPostMarkersSchema = Joi.object({
      postId: Joi.number().integer().positive().required(),
      includeRemoved: Joi.boolean().default(false),
      markerType: Joi.string().optional(),
    })

    const getCommentMarkersSchema = Joi.object({
      commentId: Joi.number().integer().positive().required(),
      includeRemoved: Joi.boolean().default(false),
      markerType: Joi.string().optional(),
    })

    const getUserMarkersSchema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      includeRemoved: Joi.boolean().default(false),
      markerType: Joi.string().optional(),
    })

    const getCreatorMarkersSchema = Joi.object({
      creatorId: Joi.number().integer().positive().required(),
      includeRemoved: Joi.boolean().default(false),
      markerType: Joi.string().optional(),
    })

    const createMarkerSchema = Joi.object({
      targetType: Joi.string()
        .valid(...Object.values(MarkerTargetType))
        .required(),
      targetId: Joi.number().integer().positive().required(),
      markerType: Joi.string()
        .valid(...Object.values(MarkerType))
        .required(),
      placedCount: Joi.number().integer().positive().default(1),
      annotation: Joi.string().max(256).allow(null, '').optional(),
    })

    const removeMarkerSchema = Joi.object({
      markerId: Joi.number().integer().positive().required(),
    })

    const getPostCountersSchema = Joi.object({
      postId: Joi.number().integer().positive().required(),
      markerType: Joi.string().optional(),
    })

    const getCommentCountersSchema = Joi.object({
      commentId: Joi.number().integer().positive().required(),
      markerType: Joi.string().optional(),
    })

    const getUserCountersSchema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      markerType: Joi.string().optional(),
    })

    // Get markers by target
    this.router.post(
      '/marker/get-post-markers',
      oauth?.('Получить маркеры поста'),
      validate(getPostMarkersSchema),
      (req, res) => this.getPostMarkers(req, res),
    )

    this.router.post(
      '/marker/get-comment-markers',
      oauth?.('Получить маркеры комментария'),
      validate(getCommentMarkersSchema),
      (req, res) => this.getCommentMarkers(req, res),
    )

    this.router.post(
      '/marker/get-user-markers',
      oauth?.('Получить маркеры пользователя'),
      validate(getUserMarkersSchema),
      (req, res) => this.getUserMarkers(req, res),
    )

    // Get markers created by a user
    this.router.post(
      '/marker/get-by-creator',
      oauth?.('Получить маркеры созданные пользователем'),
      validate(getCreatorMarkersSchema),
      (req, res) => this.getMarkersByCreator(req, res),
    )

    // Get token information for the current user
    this.router.post('/marker/get-tokens', oauth?.('Получить информацию о жетонах'), (req, res) =>
      this.getUserTokenInfo(req, res),
    )

    // Create a new marker
    this.router.post(
      '/marker/create',
      oauth?.('Создать маркер'),
      this.markerCreateRateLimiter,
      validate(createMarkerSchema),
      (req, res) => this.createMarker(req, res),
    )

    // Remove a marker
    this.router.post(
      '/marker/remove',
      oauth?.('Удалить маркер'),
      this.markerRemoveRateLimiter,
      validate(removeMarkerSchema),
      (req, res) => this.removeMarker(req, res),
    )

    // Get token counters for a target
    this.router.post(
      '/marker/get-post-counters',
      oauth?.('Получить количество жетонов у поста'),
      validate(getPostCountersSchema),
      (req, res) => this.getPostCounters(req, res),
    )

    this.router.post(
      '/marker/get-comment-counters',
      oauth?.('Получить количество жетонов у комментария'),
      validate(getCommentCountersSchema),
      (req, res) => this.getCommentCounters(req, res),
    )

    this.router.post(
      '/marker/get-user-counters',
      oauth?.('Получить количество жетонов у пользователя'),
      validate(getUserCountersSchema),
      (req, res) => this.getUserCounters(req, res),
    )
  }

  private async getPostMarkers(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const postId = parseInt(req.body.postId, 10)
      const includeRemoved = req.body.includeRemoved === true
      const markerType = req.body.markerType as string

      const markers = await this.markerManager.getMarkersByTarget(
        MarkerTargetType.POST,
        postId,
        markerType,
        includeRemoved,
      )

      return res.success({ markers })
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getPostMarkers:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getCommentMarkers(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const commentId = parseInt(req.body.commentId, 10)
      const includeRemoved = req.body.includeRemoved === true
      const markerType = req.body.markerType as string

      const markers = await this.markerManager.getMarkersByTarget(
        MarkerTargetType.COMMENT,
        commentId,
        markerType,
        includeRemoved,
      )

      return res.success({ markers })
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getCommentMarkers:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getUserMarkers(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const userId = parseInt(req.body.userId, 10)
      const includeRemoved = req.body.includeRemoved === true
      const markerType = req.body.markerType as string

      const markers = await this.markerManager.getMarkersByTarget(
        MarkerTargetType.USER,
        userId,
        markerType,
        includeRemoved,
      )

      return res.success({ markers })
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getUserMarkers:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getMarkersByCreator(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const creatorId = parseInt(req.body.creatorId, 10)
      const includeRemoved = req.body.includeRemoved === true
      const markerType = req.body.markerType as string

      const markers = await this.markerManager.getMarkersByCreator(creatorId, markerType, includeRemoved)

      return res.success({ markers })
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getMarkersByCreator:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getUserTokenInfo(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const userId = req.session.data.userId
      const tokenInfo = await this.markerManager.getUserTokenInfo(userId)

      return res.success(tokenInfo)
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getUserTokenInfo:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async createMarker(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const userId = req.session.data.userId
      const { targetType, targetId, markerType, placedCount, annotation } = req.body

      // Most validation is now handled by Joi schema
      // Validation for prefixed marker types has been removed - we now use simple marker types (star, note, bookmark)
      // The target type is already specified by the targetType parameter and doesn't need to be encoded in the marker type

      const marker = await this.markerManager.createMarker(
        userId,
        targetType,
        targetId,
        markerType,
        placedCount || 1,
        annotation || null,
      )

      return res.success(marker)
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in createMarker:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async removeMarker(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const userId = req.session.data.userId
      const markerId = parseInt(req.body.markerId, 10)

      // Validation is now handled by Joi schema

      await this.markerManager.removeMarker(markerId, userId)

      return res.success({ success: true })
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in removeMarker:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getPostCounters(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const postId = parseInt(req.body.postId, 10)
      const markerType = req.body.markerType as string

      const counters = await this.markerManager.getCounters(MarkerTargetType.POST, postId, markerType)

      return res.success(counters)
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getPostCounters:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getCommentCounters(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const commentId = parseInt(req.body.commentId, 10)
      const markerType = req.body.markerType as string

      const counters = await this.markerManager.getCounters(MarkerTargetType.COMMENT, commentId, markerType)

      return res.success(counters)
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getCommentCounters:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  private async getUserCounters(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    if (!req.session.data.userId) {
      return res.authRequired()
    }

    try {
      const userId = parseInt(req.body.userId, 10)
      const markerType = req.body.markerType as string

      const counters = await this.markerManager.getCounters(MarkerTargetType.USER, userId, markerType)

      return res.success(counters)
    } catch (error) {
      if (error instanceof CodeError) {
        return res.error(error.code, error.message, 400)
      } else {
        this.logger?.error('Error in getUserCounters:', error)
        return res.error('internal-error', 'Internal server error', 500)
      }
    }
  }

  getRouter() {
    return this.router
  }
}
