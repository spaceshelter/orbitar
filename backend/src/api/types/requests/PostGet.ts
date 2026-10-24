import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { SiteWithUserInfoEntity } from '../entities/SiteEntity'
import { UserEntity } from '../entities/UserEntity'

export type PostGetRequest = {
  id: number
  format?: ContentFormat
  noComments?: boolean
  commentIndex?: boolean
}

export type PostCommentIndexEntry = {
  id: number
  parentComment?: number
  isNew?: boolean
}

export type PostGetResponse = {
  post: PostEntity
  site: SiteWithUserInfoEntity
  comments: CommentEntity[]
  commentIndex?: PostCommentIndexEntry[]
  users: Record<number, UserEntity>
  anonymousUser?: UserEntity
}
