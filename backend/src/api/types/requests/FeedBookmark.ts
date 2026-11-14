import { ContentFormat } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { SiteBaseEntity } from '../entities/SiteEntity'
import { UserEntity } from '../entities/UserEntity'

export type FeedBookmarkRequest = {
  filter?: string
  page?: number
  perpage?: number
  format?: ContentFormat
}

export type FeedBookmarkResponse = {
  posts: PostEntity[]
  total: number
  users: Record<number, UserEntity>
  sites: Record<string, SiteBaseEntity>
}
