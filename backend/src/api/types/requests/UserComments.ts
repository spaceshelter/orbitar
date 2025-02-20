import { CommentEntity } from '../entities/CommentEntity'
import { ContentFormat } from '../entities/common'
import { UserEntity } from '../entities/UserEntity'

export type UserCommentsRequest = {
  username: string
  format: ContentFormat
  filter?: string
  page?: number
  perpage?: number
}

export type UserCommentsResponse = {
  comments: CommentEntity[]
  total: number
  users: Record<number, UserEntity>
  parentComments: Record<number, CommentEntity>
}
