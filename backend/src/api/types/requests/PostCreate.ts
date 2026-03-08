import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { EncryptedPayloadRequestMixin } from './EncryptedPayload'

export type PostCreateRequest = EncryptedPayloadRequestMixin & {
  site: string
  title: string
  content: string
  format?: ContentFormat
}

export type PostCreateResponse = {
  post: PostEntity
}
