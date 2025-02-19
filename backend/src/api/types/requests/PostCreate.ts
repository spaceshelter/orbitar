import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'

export type PostCreateRequest = {
  site: string
  title: string
  content: string
  format?: ContentFormat
}

export type PostCreateResponse = {
  post: PostEntity
}
