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

type UserVoteFeedEventBase = {
  vote: number
  votedAt: string
  voterId: number
  targetUserId: number
}

export type UserVoteFeedPostEvent = UserVoteFeedEventBase & {
  type: 'post'
  post: PostEntity
}

export type UserVoteFeedCommentEvent = UserVoteFeedEventBase & {
  type: 'comment'
  comment: CommentEntity
  parentComment?: CommentEntity
  postTitle?: string
}

export type UserVoteFeedUserEvent = UserVoteFeedEventBase & {
  type: 'user'
  user: UserEntity
}

export type UserVoteFeedEvent = UserVoteFeedPostEvent | UserVoteFeedCommentEvent | UserVoteFeedUserEvent

export type UserVotesResponse = {
  events: UserVoteFeedEvent[]
  users: Record<number, UserEntity>
  hasMore: boolean
  nextCursor?: string
}
