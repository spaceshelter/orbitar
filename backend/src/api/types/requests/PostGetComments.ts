import { CommentEntity } from '../entities/CommentEntity'
import { UserEntity } from '../entities/UserEntity'

export type PostGetCommentsRequest = {
  postId: number
  ids: number[]
}

export type PostGetCommentsResponse = {
  comments: CommentEntity[]
  users: Record<number, UserEntity>
}
