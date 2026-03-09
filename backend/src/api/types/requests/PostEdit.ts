import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { UserEntity } from '../entities/UserEntity'
import { EncryptedPayloadRequestMixin } from './EncryptedPayload'

export type PostEditRequest = EncryptedPayloadRequestMixin & {
  id: number
  title?: string
  content: string
  format?: ContentFormat
}

export type PostEditResponse = {
  post: PostEntity
  users: Record<number, UserEntity>
}
