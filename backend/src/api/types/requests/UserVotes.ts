import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { UserEntity } from '../entities/UserEntity'

export type UserVotesDirection = 'mine' | 'received'

export type UserVotesRequest = {
  direction: UserVotesDirection
  format: ContentFormat
  filter?: string
  cursor?: string
  perpage?: number
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
  postTitle?: string
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
        postTitles: Record<number, string>
      }
    })
  | (UserVotesResponseBase & {
      direction: 'received'
      subjects: {
        posts: Record<number, ReceivedPostSubject>
        comments: Record<number, ReceivedCommentSubject>
      }
    })
