import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { UserEntity } from '../entities/UserEntity'
import { EncryptedPayloadRequestMixin } from './EncryptedPayload'

export type PostCommentRequest = EncryptedPayloadRequestMixin & {
  comment_id?: number
  post_id: number
  content: string
  format?: ContentFormat
}

export type PostCommentResponse = {
  comment: CommentEntity
  users: Record<number, UserEntity>
}
