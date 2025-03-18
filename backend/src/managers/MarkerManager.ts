import { RedisClientType } from 'redis'

import CodeError from '../CodeError'
import CommentRepository from '../db/repositories/CommentRepository'
import { MarkerRepository } from '../db/repositories/MarkerRepository'
import { MarkerRaw } from '../db/types/MarkerRaw'
import PostManager from './PostManager'
import { CommentInfoWithPostData } from './types/CommentInfo'
import { ContentFormat } from './types/common'
import { MarkerInfo, MarkerTargetType, MarkerType, TokenCounter, UserTokenInfo } from './types/MarkerInfo'
import { PostInfo } from './types/PostInfo'
import { UserInfo } from './types/UserInfo'
import UserManager from './UserManager'

export default class MarkerManager {
  private markerRepository: MarkerRepository
  private userManager: UserManager
  private postManager: PostManager
  private commentRepository: CommentRepository
  private readonly redis: RedisClientType
  private tokensPerDay = 200 // Users get 4 tokens per day
  private redisExpirationSeconds = 60 * 60 * 24 // 24 hours

  constructor(
    markerRepository: MarkerRepository,
    userManager: UserManager,
    postManager: PostManager,
    commentRepository: CommentRepository,
    redis: RedisClientType,
  ) {
    this.markerRepository = markerRepository
    this.userManager = userManager
    this.postManager = postManager
    this.commentRepository = commentRepository
    this.redis = redis
  }

  private async convertToMarkerInfo(raw: MarkerRaw): Promise<MarkerInfo> {
    const creator = await this.userManager.getById(raw.creator_id)
    return {
      markerId: raw.marker_id,
      creator: {
        id: creator.id,
        username: creator.username,
        gender: creator.gender,
      },
      postId: raw.post_id,
      commentId: raw.comment_id,
      userId: raw.user_id,
      markerType: raw.marker_type,
      placedCount: raw.placed_count,
      createdAt: raw.created_at,
      removedAt: raw.removed_at,
      annotation: raw.annotation,
    }
  }

  /**
   * Calculate maximum number of tokens a user can have
   */
  async calculateMaxTokens(user: UserInfo): Promise<number> {
    // Base tokens (everyone gets at least 10)
    const maxTokens = 200

    // Could scale with karma in the future if needed
    return maxTokens
  }

  /**
   * Calculate available tokens based on the time-based approach
   * Users get 4 tokens per day
   */
  async calculateAvailableTokens(userId: number): Promise<number> {
    // Get user to ensure they exist
    const user = await this.userManager.getById(userId)
    if (!user) {
      throw new CodeError('User not found', 'user_not_found')
    }

    // Calculate the time period for token calculation (24 hours)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get all markers placed by the user in the last 24 hours
    const recentMarkers = await this.markerRepository.getMarkersByCreatorInTimePeriod({
      creatorId: userId,
      startDate: oneDayAgo,
      endDate: now,
    })

    // Count tokens used in the last 24 hours
    const tokensUsed = recentMarkers.reduce((sum, marker) => sum + marker.placed_count, 0)

    // Calculate available tokens (max tokens per day minus tokens used)
    const availableTokens = Math.max(0, this.tokensPerDay - tokensUsed)

    return availableTokens
  }

  async getUserTokenInfo(userId: number): Promise<UserTokenInfo> {
    // Get user to calculate max tokens
    const user = await this.userManager.getById(userId)
    if (!user) {
      throw new CodeError('User not found', 'user_not_found')
    }

    const maxTokens = await this.calculateMaxTokens(user)
    const availableTokens = await this.calculateAvailableTokens(userId)
    const historyRaw = await this.markerRepository.getRecentTokenHistory({
      userId,
    })

    // Process marker history and add creator usernames
    const history: MarkerInfo[] = []
    for (const raw of historyRaw) {
      const markerInfo = await this.convertToMarkerInfo(raw)
      history.push(markerInfo)
    }

    return {
      availableTokens,
      maxTokens,
      history,
    }
  }

  async createMarker(
    creatorId: number,
    targetType: MarkerTargetType,
    targetId: number,
    markerType: MarkerType,
    placedCount = 1,
    annotation: string | null = null,
  ): Promise<MarkerInfo> {
    // Verify user exists
    const user = await this.userManager.getById(creatorId)
    if (!user) {
      throw new CodeError('User not found', 'user_not_found')
    }

    // Check if the user has enough tokens based on time-based calculation
    const availableTokens = await this.calculateAvailableTokens(creatorId)
    if (availableTokens < placedCount) {
      throw new CodeError('Not enough tokens', 'not_enough_tokens')
    }

    // Use the consolidated createMarker method from repository
    const marker = await this.markerRepository.createMarker({
      creatorId,
      targetId,
      targetType,
      markerType,
      placedCount,
      annotation,
    })

    // Invalidate marker cache since we've added a new marker
    await this.invalidateMarkerCache(creatorId)

    return await this.convertToMarkerInfo(marker)
  }

  // Deprecated methods createPostMarker, createCommentMarker, and createUserMarker
  // have been removed in favor of using createMarker with explicit marker types

  async removeMarker(markerId: number, userId: number): Promise<void> {
    const marker = await this.markerRepository.getMarkerById({ markerId })
    if (!marker) {
      throw new CodeError('Marker not found', 'marker_not_found')
    }

    // Only the creator can remove their marker
    if (marker.creator_id !== userId) {
      throw new CodeError('Unauthorized to remove this marker', 'unauthorized')
    }

    await this.markerRepository.removeMarker({ markerId })

    // Invalidate marker cache since we've removed a marker
    await this.invalidateMarkerCache(marker.creator_id)
  }

  async getMarkersByTarget(
    targetType: MarkerTargetType,
    targetId: number,
    markerType?: string,
    includeRemoved = false,
  ): Promise<MarkerInfo[]> {
    // Map MarkerTargetType to the repository's targetType string
    const repoTargetType = targetType.toString()

    // Use the consolidated getMarkers method from repository
    const markers = await this.markerRepository.getMarkers({
      targetId,
      targetType: repoTargetType as 'post' | 'comment' | 'user',
      markerType,
      includeRemoved,
    })

    // Process markers and add creator usernames
    return await Promise.all(markers.map((marker) => this.convertToMarkerInfo(marker)))
  }

  async getMarkersByCreator(creatorId: number, markerType?: string, includeRemoved = false): Promise<MarkerInfo[]> {
    const markers = await this.markerRepository.getMarkersByCreator({
      creatorId,
      markerType,
      includeRemoved,
    })

    // Process markers and add creator usernames
    return await Promise.all(markers.map((marker) => this.convertToMarkerInfo(marker)))
  }

  async getMarkedPostIds(
    creatorId: number,
    markerTypes?: string[],
    filter?: string,
    page = 1,
    perpage = 20,
  ): Promise<{ postIds: number[]; total: number }> {
    // Calculate offset from page and perpage
    const offset = (page - 1) * perpage

    // Get post IDs from repository with pagination
    const { ids, total } = await this.markerRepository.getMarkedPostIds({
      creatorId,
      markerTypes,
      filter,
      limit: perpage,
      offset,
    })

    return { postIds: ids, total }
  }

  async getMarkedCommentIds(
    creatorId: number,
    markerTypes?: string[],
    filter?: string,
    page = 1,
    perpage = 20,
  ): Promise<{ commentIds: number[]; total: number }> {
    // Calculate offset from page and perpage
    const offset = (page - 1) * perpage

    // Get comment IDs from repository with pagination
    const { ids, total } = await this.markerRepository.getMarkedCommentIds({
      creatorId,
      markerTypes,
      filter,
      limit: perpage,
      offset,
    })

    return { commentIds: ids, total }
  }

  async getMarkedUserIds(
    creatorId: number,
    markerTypes?: string[],
    filter?: string,
    page = 1,
    perpage = 20,
  ): Promise<{ userIds: number[]; total: number }> {
    // Calculate offset from page and perpage
    const offset = (page - 1) * perpage

    // Get user IDs from repository with pagination
    const { ids, total } = await this.markerRepository.getMarkedUserIds({
      creatorId,
      markerTypes,
      filter,
      limit: perpage,
      offset,
    })

    return { userIds: ids, total }
  }

  /**
   * Get marked posts with all necessary data
   */
  async getMarkedPosts(
    creatorId: number,
    viewerId: number,
    markerTypes?: string[],
    filter?: string,
    format: ContentFormat = 'html',
    page = 1,
    perpage = 20,
  ): Promise<{
    posts: PostInfo[]
    total: number
  }> {
    if (!this.postManager) {
      throw new CodeError('PostManager not set', 'configuration_error')
    }

    const { postIds, total } = await this.getMarkedPostIds(creatorId, markerTypes, filter, page, perpage)
    const { posts } = await this.postManager.getPostsByIds(postIds, viewerId, format)

    return { posts, total }
  }

  /**
   * Get marked comments with all necessary data
   * Includes parent comments for thread context
   */
  async getMarkedComments(
    creatorId: number,
    viewerId: number,
    markerTypes?: string[],
    filter?: string,
    format: ContentFormat = 'html',
    page = 1,
    perpage = 20,
  ): Promise<{
    comments: CommentInfoWithPostData[]
    parentComments: Record<number, CommentInfoWithPostData>
    users: Record<number, UserInfo>
    total: number
  }> {
    if (!this.postManager) {
      throw new CodeError('PostManager not set', 'configuration_error')
    }

    const { commentIds, total } = await this.getMarkedCommentIds(creatorId, markerTypes, filter, page, perpage)

    return {
      ...(await this.postManager.getCommentsByIds(commentIds, viewerId, format)),
      total,
    }
  }

  /**
   * Get marked users with all necessary data
   */
  async getMarkedUsers(
    creatorId: number,
    markerTypes?: string[],
    filter?: string,
    page = 1,
    perpage = 20,
  ): Promise<{
    users: Record<number, UserInfo>
    total: number
  }> {
    const { userIds, total } = await this.getMarkedUserIds(creatorId, markerTypes, filter, page, perpage)

    // Fetch user data for all marked users sequentially
    const users: Record<number, UserInfo> = {}

    for (const id of userIds) {
      const user = await this.userManager.getById(id)
      if (user) {
        users[user.id] = user
      }
    }

    return { users, total }
  }

  async getCounters(targetType: MarkerTargetType, targetId: number, markerType?: string): Promise<TokenCounter> {
    // Create a params object with only the relevant property based on targetType
    const params: { [key: string]: any } = {
      markerType,
    }

    // Set the appropriate ID property based on targetType
    switch (targetType) {
      case MarkerTargetType.POST:
        params.postId = targetId
        break
      case MarkerTargetType.COMMENT:
        params.commentId = targetId
        break
      case MarkerTargetType.USER:
        params.userId = targetId
        break
      default:
        throw new CodeError('Invalid target type', 'invalid_target_type')
    }

    return await this.markerRepository.getMarkerCounts(params)
  }

  /**
   * Build a Redis cache key for distinct target counts
   */
  private buildDistinctTargetsCacheKey(
    creatorId: number,
    targetType: MarkerTargetType | 'all',
    markerTypes?: MarkerType[],
  ): string {
    const markerTypesString = markerTypes?.length ? ':' + markerTypes.sort().join('-') : ''

    return `marker:distinct-targets:${creatorId}:${targetType}${markerTypesString}`
  }

  /**
   * Invalidate cache for a user's marker counts
   * Called whenever markers are added or removed
   */
  private async invalidateMarkerCache(creatorId: number): Promise<void> {
    // Get all keys matching the pattern for this creator
    const keys = await this.redis.keys(`marker:distinct-targets:${creatorId}:*`)

    if (keys.length > 0) {
      // Delete all matching keys in a single operation
      await this.redis.del(keys)
    }
  }

  /**
   * Count distinct targets marked by a user with Redis caching
   * Can count a specific target type or all target types combined
   *
   * @param creatorId The ID of the user who created the markers
   * @param targetType The type of target to count, or 'all' to count all types
   * @param markerTypes Optional array of marker types to filter by
   * @returns Number of distinct targets marked by the user
   */
  async countDistinctTargetsByCreator(
    creatorId: number,
    targetType: MarkerTargetType | 'all',
    markerTypes?: MarkerType[],
  ): Promise<number> {
    // Verify user exists
    const user = await this.userManager.getById(creatorId)
    if (!user) {
      throw new CodeError('User not found', 'user_not_found')
    }

    // Build cache key
    const cacheKey = this.buildDistinctTargetsCacheKey(creatorId, targetType, markerTypes)

    // Try to get from cache first
    const cachedCount = await this.redis.get(cacheKey)
    if (cachedCount !== null) {
      return parseInt(cachedCount, 10)
    }

    let count = 0

    if (targetType === 'all') {
      // Count all target types and sum them up
      const targetTypes: Array<'post' | 'comment' | 'user'> = ['post', 'comment', 'user']
      const counts = await Promise.all(
        targetTypes.map((type) =>
          this.markerRepository.countDistinctTargetIds({
            creatorId,
            targetType: type,
            markerTypes: markerTypes as string[],
          }),
        ),
      )

      // Sum all counts
      count = counts.reduce((total, current) => total + current, 0)
    } else {
      // Count a specific target type
      const repoTargetType = targetType.toString() as 'post' | 'comment' | 'user'
      count = await this.markerRepository.countDistinctTargetIds({
        creatorId,
        targetType: repoTargetType,
        markerTypes: markerTypes as string[],
      })
    }

    // Cache the result
    await this.redis.set(cacheKey, count.toString())
    await this.redis.expire(cacheKey, this.redisExpirationSeconds)

    return count
  }
}
