import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { UserEntity } from '../entities/UserEntity'

export type UserVotesDirection = 'mine' | 'received'
export type UserVoteFeedGroupKind = 'entity' | 'voter' | 'target-author' | 'context-post' | 'single'

export type UserVotesRequest = {
  direction: UserVotesDirection
  format: ContentFormat
  filter?: string
  page?: number
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
}

export type UserVoteFeedUserEvent = UserVoteFeedEventBase & {
  type: 'user'
  user: UserEntity
}

export type UserVoteFeedEvent = UserVoteFeedPostEvent | UserVoteFeedCommentEvent | UserVoteFeedUserEvent

export type UserVoteFeedGroup = {
  kind: UserVoteFeedGroupKind
  latestAt: string
  events: UserVoteFeedEvent[]
  entityType?: 'post' | 'comment' | 'user'
  entityId?: number
  voterId?: number
  targetUserId?: number
  contextPostId?: number
}

export type UserVotesResponse = {
  total: number
  groups: UserVoteFeedGroup[]
  users: Record<number, UserEntity>
}
