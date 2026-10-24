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
  // Lower bound on voted_at; Joi validation converts the ISO string to a Date.
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

// What a post or comment without text consists of; 'media' when it can't be told.
export type ReceivedMediaKind = 'image' | 'gif' | 'video' | 'media'

export type ReceivedPostSubject = {
  id: number
  site: string
  // The title, or the start of the text of an untitled post; empty without both.
  label: string
  media?: ReceivedMediaKind
  rating: number
}

export type ReceivedCommentSubject = {
  id: number
  postId: number
  site: string
  // The post's title, or the start of its text when it has none.
  postTitle?: string
  // What an untitled post without text consists of.
  postMedia?: ReceivedMediaKind
  // Plain-text start of the comment; empty when it has no text.
  excerpt: string
  // What a comment without text consists of, so it can be named instead of quoted.
  media?: ReceivedMediaKind
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
