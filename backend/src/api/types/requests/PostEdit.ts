import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { UserEntity } from '../entities/UserEntity'

export type PostEditRequest = {
  id: number
  title?: string
  content: string
  format?: ContentFormat
}

export type PostEditResponse = {
  post: PostEntity
  users: Record<number, UserEntity>
}
