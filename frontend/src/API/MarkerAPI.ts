import { TokenCounts } from '../Types/TokenCounts'
import { UserBaseInfo } from '../Types/UserInfo'
import APIBase from './APIBase'

export enum MarkerTargetType {
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

export interface MarkerInfo {
  markerId: number
  creator: UserBaseInfo
  postId: number | null
  commentId: number | null
  userId: number | null
  markerType: MarkerType
  placedCount: number
  createdAt: string
  removedAt: string | null
  annotation: string | null
}

export interface TokenCounter {
  count: number
  starCount?: number // camelCase version
  noteCount?: number
  bookmarkCount?: number
  star_count?: number // snake_case version from API
  note_count?: number
  bookmark_count?: number
}

// Convert API TokenCounter to UI TokenCounts
export function toTokenCounts(counter: TokenCounter): TokenCounts {
  return {
    stars: counter.starCount || counter.star_count || 0,
    notes: counter.noteCount || counter.note_count || 0,
    bookmarks: counter.bookmarkCount || counter.bookmark_count || 0,
  }
}

export interface UserTokenInfo {
  availableTokens: number
  maxTokens: number
  history: MarkerInfo[]
}

export class MarkerAPI extends APIBase {
  constructor() {
    super()
  }

  /**
   * Get token counters for a post
   */
  async getPostCounters(postId: number): Promise<TokenCounter> {
    return await this.request<{ postId: number }, TokenCounter>('/marker/get-post-counters', { postId })
  }

  /**
   * Get token counters for a comment
   */
  async getCommentCounters(commentId: number): Promise<TokenCounter> {
    return await this.request<{ commentId: number }, TokenCounter>('/marker/get-comment-counters', {
      commentId,
    })
  }

  /**
   * Get token counters for a user
   */
  async getUserCounters(userId: number): Promise<TokenCounter> {
    return await this.request<{ userId: number }, TokenCounter>('/marker/get-user-counters', { userId })
  }

  /**
   * Get markers placed on a post
   */
  async getPostMarkers(postId: number, includeRemoved: boolean): Promise<MarkerInfo[]> {
    const response = await this.request<{ postId: number; includeRemoved: boolean }, { markers: MarkerInfo[] }>(
      '/marker/get-post-markers',
      {
        postId,
        includeRemoved,
      },
    )
    return response.markers
  }

  /**
   * Get markers placed on a comment
   */
  async getCommentMarkers(commentId: number, includeRemoved: boolean): Promise<MarkerInfo[]> {
    const response = await this.request<{ commentId: number; includeRemoved: boolean }, { markers: MarkerInfo[] }>(
      '/marker/get-comment-markers',
      {
        commentId,
        includeRemoved,
      },
    )
    return response.markers
  }

  /**
   * Get markers placed on a user
   */
  async getUserMarkers(userId: number, includeRemoved: boolean): Promise<MarkerInfo[]> {
    const response = await this.request<{ userId: number; includeRemoved: boolean }, { markers: MarkerInfo[] }>(
      '/marker/get-user-markers',
      {
        userId,
        includeRemoved,
      },
    )
    return response.markers
  }

  /**
   * Get markers by target type and ID
   */
  async getMarkersByTarget(
    targetType: MarkerTargetType,
    targetId: number,
    includeRemoved: boolean,
  ): Promise<MarkerInfo[]> {
    switch (targetType) {
      case MarkerTargetType.POST:
        return this.getPostMarkers(targetId, includeRemoved)
      case MarkerTargetType.COMMENT:
        return this.getCommentMarkers(targetId, includeRemoved)
      case MarkerTargetType.USER:
        return this.getUserMarkers(targetId, includeRemoved)
      default:
        throw new Error(`Invalid target type: ${targetType}`)
    }
  }

  /**
   * Get markers created by a specific user
   */
  async getMarkersByCreator(creatorId: number, includeRemoved: boolean): Promise<MarkerInfo[]> {
    const response = await this.request<{ creatorId: number; includeRemoved: boolean }, { markers: MarkerInfo[] }>(
      '/marker/get-by-creator',
      {
        creatorId,
        includeRemoved,
      },
    )
    return response.markers
  }

  /**
   * Get token information for the current user
   */
  async getUserTokenInfo(): Promise<UserTokenInfo> {
    return await this.request<Record<string, never>, UserTokenInfo>('/marker/get-tokens', {})
  }

  /**
   * Create a new marker
   */
  async createMarker(
    targetType: MarkerTargetType,
    targetId: number,
    markerType: MarkerType,
    placedCount: number,
    annotation: string | null,
  ): Promise<MarkerInfo> {
    return await this.request<
      {
        targetType: MarkerTargetType
        targetId: number
        markerType: string
        placedCount: number
        annotation: string | null
      },
      MarkerInfo
    >('/marker/create', {
      targetType,
      targetId,
      markerType,
      placedCount,
      annotation,
    })
  }

  /**
   * Remove a marker
   */
  async removeMarker(markerId: number): Promise<void> {
    await this.request<{ markerId: number }, void>('/marker/remove', { markerId })
  }

  /**
   * Get counters based on target type
   */
  async getCounters(targetType: MarkerTargetType, targetId: number): Promise<TokenCounter> {
    switch (targetType) {
      case MarkerTargetType.POST:
        return this.getPostCounters(targetId)
      case MarkerTargetType.COMMENT:
        return this.getCommentCounters(targetId)
      case MarkerTargetType.USER:
        return this.getUserCounters(targetId)
      default:
        throw new Error(`Invalid target type: ${targetType}`)
    }
  }

  /**
   * Get token counts for UI display
   */
  async getTokenCounts(targetType: MarkerTargetType, targetId: number): Promise<TokenCounts> {
    const counters = await this.getCounters(targetType, targetId)
    return toTokenCounts(counters)
  }
}

export enum MarkerType {
  STAR = 'star',
  NOTE = 'note',
  BOOKMARK = 'bookmark',
}

// Backend API has been updated to use simple marker types (star/note/bookmark)
// as recommended in /docs/markers.md
export default new MarkerAPI()
