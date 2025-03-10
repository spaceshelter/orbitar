import { Router } from 'express'
import { Logger } from 'winston'

import CodeError from '../CodeError'
import { MarkerManager } from '../managers/MarkerManager'
import { MarkerTargetType, MarkerType } from '../managers/types/MarkerInfo'
import { APIRequest, APIResponse } from './ApiMiddleware'
import { OAuth2MiddlewareGenerator } from './OAuth2Middleware'

export class MarkerController {
  public readonly router = Router()
  private markerManager: MarkerManager
  private logger: Logger | undefined

  constructor(markerManager: MarkerManager, oauth?: OAuth2MiddlewareGenerator, logger?: Logger) {
    this.markerManager = markerManager
    this.logger = logger

    const authMiddleware = oauth ? oauth('работать с маркерами') : (req, res, next) => next()

    // Get markers by target
    this.router.post('/marker/get-post-markers', authMiddleware, (req, res) => this.getPostMarkers(req, res))
    this.router.post('/marker/get-comment-markers', authMiddleware, (req, res) => this.getCommentMarkers(req, res))
    this.router.post('/marker/get-user-markers', authMiddleware, (req, res) => this.getUserMarkers(req, res))

    // Get markers created by a user
    this.router.post('/marker/get-by-creator', authMiddleware, (req, res) => this.getMarkersByCreator(req, res))

    // Get token information for the current user
    this.router.post('/marker/get-tokens', authMiddleware, (req, res) => this.getUserTokenInfo(req, res))

    // Create a new marker
    this.router.post('/marker/create', authMiddleware, (req, res) => this.createMarker(req, res))

    // Remove a marker
    this.router.post('/marker/remove', authMiddleware, (req, res) => this.removeMarker(req, res))

    // Get token counters for a target
    this.router.post('/marker/get-post-counters', authMiddleware, (req, res) => this.getPostCounters(req, res))
    this.router.post('/marker/get-comment-counters', authMiddleware, (req, res) => this.getCommentCounters(req, res))
    this.router.post('/marker/get-user-counters', authMiddleware, (req, res) => this.getUserCounters(req, res))
  }

  private async getPostMarkers(req: APIRequest<any>, res: APIResponse<any>): Promise<void> {
    try {
      const postId = parseInt(req.body.postId, 10)

      if (isNaN(postId) || postId <= 0) {
        throw new CodeError('Invalid post ID', 'invalid_post_id')
      }

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
    try {
      const commentId = parseInt(req.body.commentId, 10)

      if (isNaN(commentId) || commentId <= 0) {
        throw new CodeError('Invalid comment ID', 'invalid_comment_id')
      }

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
    try {
      const userId = parseInt(req.body.userId, 10)

      if (isNaN(userId) || userId <= 0) {
        throw new CodeError('Invalid user ID', 'invalid_user_id')
      }

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
    try {
      const creatorId = parseInt(req.body.creatorId, 10)

      if (isNaN(creatorId) || creatorId <= 0) {
        throw new CodeError('Invalid creator ID', 'invalid_creator_id')
      }

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
    try {
      const userId = res.locals.user.id
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
    try {
      const userId = res.locals.user.id
      const { targetType, targetId, markerType, placedCount, annotation } = req.body

      if (!Object.values(MarkerTargetType).includes(targetType)) {
        throw new CodeError('Invalid target type', 'invalid_target_type')
      }

      if (isNaN(targetId) || targetId <= 0) {
        throw new CodeError('Invalid target ID', 'invalid_target_id')
      }

      // Validate markerType
      if (!markerType || typeof markerType !== 'string') {
        throw new CodeError('Marker type is required', 'missing_marker_type')
      }

      // Validate that the markerType matches the targetType
      const validMarkerTypes = Object.values(MarkerType)
      if (!validMarkerTypes.includes(markerType as MarkerType)) {
        throw new CodeError('Invalid marker type', 'invalid_marker_type')
      }

      // Additional validation to ensure marker type matches target type
      if (targetType === MarkerTargetType.POST && !markerType.startsWith('post_')) {
        throw new CodeError('Invalid marker type for post target', 'invalid_marker_type_for_target')
      }

      if (targetType === MarkerTargetType.COMMENT && !markerType.startsWith('comment_')) {
        throw new CodeError('Invalid marker type for comment target', 'invalid_marker_type_for_target')
      }

      if (targetType === MarkerTargetType.USER && !markerType.startsWith('user_')) {
        throw new CodeError('Invalid marker type for user target', 'invalid_marker_type_for_target')
      }

      if (placedCount && (isNaN(placedCount) || placedCount <= 0)) {
        throw new CodeError('Invalid placed count', 'invalid_placed_count')
      }

      if (annotation && typeof annotation !== 'string') {
        throw new CodeError('Invalid annotation', 'invalid_annotation')
      }

      if (annotation && annotation.length > 256) {
        throw new CodeError('Annotation too long (max 256 characters)', 'annotation_too_long')
      }

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
    try {
      const userId = res.locals.user.id
      const markerId = parseInt(req.body.markerId, 10)

      if (isNaN(markerId) || markerId <= 0) {
        throw new CodeError('Invalid marker ID', 'invalid_marker_id')
      }

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
    try {
      const postId = parseInt(req.body.postId, 10)

      if (isNaN(postId) || postId <= 0) {
        throw new CodeError('Invalid post ID', 'invalid_post_id')
      }

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
    try {
      const commentId = parseInt(req.body.commentId, 10)

      if (isNaN(commentId) || commentId <= 0) {
        throw new CodeError('Invalid comment ID', 'invalid_comment_id')
      }

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
    try {
      const userId = parseInt(req.body.userId, 10)

      if (isNaN(userId) || userId <= 0) {
        throw new CodeError('Invalid user ID', 'invalid_user_id')
      }

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
