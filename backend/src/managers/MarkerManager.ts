import CodeError from '../CodeError'
import { MarkerRepository } from '../db/repositories/MarkerRepository'
import { MarkerRaw } from '../db/types/MarkerRaw'
import { MarkerInfo, MarkerTargetType, MarkerType, TokenCounter, UserTokenInfo } from './types/MarkerInfo'
import { UserInfo } from './types/UserInfo'
import UserManager from './UserManager'

export class MarkerManager {
  private markerRepository: MarkerRepository
  private userManager: UserManager
  private tokensPerDay = 200 // Users get 4 tokens per day

  constructor(markerRepository: MarkerRepository, userManager: UserManager) {
    this.markerRepository = markerRepository
    this.userManager = userManager
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

  async getCounters(targetType: MarkerTargetType, targetId: number, markerType?: string): Promise<TokenCounter> {
    let counts: TokenCounter

    switch (targetType) {
      case MarkerTargetType.POST:
        counts = await this.markerRepository.getMarkerCounts({
          postId: targetId,
          markerType,
        })
        break
      case MarkerTargetType.COMMENT:
        counts = await this.markerRepository.getMarkerCounts({
          commentId: targetId,
          markerType,
        })
        break
      case MarkerTargetType.USER:
        counts = await this.markerRepository.getMarkerCounts({
          userId: targetId,
          markerType,
        })
        break
      default:
        throw new CodeError('Invalid target type', 'invalid_target_type')
    }

    // Fields should be guaranteed by repository

    return counts
  }
}
