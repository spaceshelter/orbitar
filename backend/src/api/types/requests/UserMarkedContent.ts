import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { SiteEntity } from '../entities/SiteEntity'
import { UserEntity } from '../entities/UserEntity'

/**
 * Request parameters for fetching a user's marked content
 * Allows filtering by content type and marker types
 */
export type UserMarkedContentRequest = {
  username: string // Username of the profile to fetch marked content for
  contentType: 'posts' | 'comments' | 'users' // Type of content to fetch
  markerTypes?: string[] // Optional filter by marker types (star, note, bookmark)
  filter?: string // Optional text search filter
  format?: ContentFormat // Content format (html, markdown, etc.)
  page?: number // Pagination page number
  perpage?: number // Items per page
}

/**
 * Response containing the user's marked content
 * Contains different content based on the requested content type
 */
export type UserMarkedContentResponse = {
  posts?: PostEntity[] // Present when contentType is 'posts'
  comments?: CommentEntity[] // Present when contentType is 'comments'
  parentComments?: Record<number, CommentEntity> // Parent comments for context when comments are present
  users: Record<number, UserEntity> // User information for authors
  sites?: Record<string, SiteEntity> // Site information
  total: number // Total count for pagination
}
