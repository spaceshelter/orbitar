import { CommentEntity } from '../entities/CommentEntity'
import { PostEntity } from '../entities/PostEntity'
import { UserEntity } from '../entities/UserEntity'

export type UserVotesDirection = 'mine' | 'received'

export type UserVotesRequest = {
  direction: UserVotesDirection
  filter?: string
  cursor?: string
  perpage?: number
  type?: 'post' | 'comment' | 'user'
  sign?: 'minus'
  // Joi converts the ISO string to a Date.
  since?: Date
}

export type UserVoteFeedEventRef = {
  type: 'post' | 'comment' | 'user'
  entityId: number
  postId?: number
  vote: number
  votedAt: string
  voterId: number
  targetUserId: number
}

// A voted post or the post of a voted comment.
export type ReceivedPostSubject = {
  id: number
  site: string
  label: string
  rating: number
}

export type ReceivedCommentSubject = {
  id: number
  postId: number
  site: string
  excerpt: string
  created: string
  rating: number
}

type UserVotesResponseBase = {
  events: UserVoteFeedEventRef[]
  users: Record<number, UserEntity>
  hasMore: boolean
  nextCursor?: string
}

export type UserVotesResponse =
  | (UserVotesResponseBase & {
      direction: 'mine'
      entities: {
        posts: Record<number, PostEntity>
        comments: Record<number, CommentEntity>
        parentComments: Record<number, CommentEntity>
      }
    })
  | (UserVotesResponseBase & {
      direction: 'received'
      subjects: {
        posts: Record<number, ReceivedPostSubject>
        comments: Record<number, ReceivedCommentSubject>
      }
    })
