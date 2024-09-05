import { ContentFormat, FeedSorting } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { SiteBaseEntity } from '../entities/SiteEntity'
import { UserEntity } from '../entities/UserEntity'

export type FeedSubscriptionsRequest = {
  page?: number
  perpage?: number
  format?: ContentFormat
}

export type FeedSubscriptionsResponse = {
  posts: PostEntity[]
  total: number
  users: Record<number, UserEntity>
  sites: Record<string, SiteBaseEntity>
  sorting: FeedSorting
}
