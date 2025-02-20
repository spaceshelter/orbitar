import { ContentFormat, FeedSorting } from '../entities/common'
import { PostEntity } from '../entities/PostEntity'
import { SiteWithUserInfoEntity } from '../entities/SiteEntity'
import { UserEntity } from '../entities/UserEntity'

export type FeedPostsRequest = {
  site: string
  page?: number
  perpage?: number
  format?: ContentFormat
}

export type FeedPostsResponse = {
  posts: PostEntity[]
  total: number
  users: Record<number, UserEntity>
  site: SiteWithUserInfoEntity
  sorting: FeedSorting
}
