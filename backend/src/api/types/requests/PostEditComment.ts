import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { UserEntity } from '../entities/UserEntity'
import { EncryptedPayloadRequestMixin } from './EncryptedPayload'

export type PostCommentEditRequest = EncryptedPayloadRequestMixin & {
  id: number
  content: string
  format?: ContentFormat
}

export type PostCommentEditResponse = {
  comment: CommentEntity
  users: Record<number, UserEntity>
}
