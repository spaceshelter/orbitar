import { CommentBaseEntity } from './CommentEntity'
import { PostBaseEntity } from './PostEntity'
import { UserBaseEntity } from './UserEntity'

export type NotificationEntity = {
  id: number
  type: 'answer' | 'mention'
  date: string
  read: boolean
  source: {
    byUser: UserBaseEntity
    post: PostBaseEntity
    comment?: CommentBaseEntity
  }
}
