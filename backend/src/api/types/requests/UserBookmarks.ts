import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { UserEntity } from '../entities/UserEntity'

export type UserBookmarksRequest = {
  username: string
  format: ContentFormat
  filter?: string
  page?: number
  perpage?: number
}

export type UserBookmarksResponse = {
  posts: PostEntity[]
  total: number
  users: Record<number, UserEntity>
}
