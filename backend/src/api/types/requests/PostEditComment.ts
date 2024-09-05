import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { UserEntity } from '../entities/UserEntity'

export type PostCommentEditRequest = {
  id: number
  content: string
  format?: ContentFormat
}

export type PostCommentEditResponse = {
  comment: CommentEntity
  users: Record<number, UserEntity>
}
