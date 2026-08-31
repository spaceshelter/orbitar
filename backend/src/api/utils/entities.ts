import { CommentInfoWithPostData } from '../../managers/types/CommentInfo'
import { PostInfo } from '../../managers/types/PostInfo'
import { UserInfo } from '../../managers/types/UserInfo'
import { CommentEntity } from '../types/entities/CommentEntity'
import { PostEntity } from '../types/entities/PostEntity'
import { UserEntity, UserGender } from '../types/entities/UserEntity'

// The single definition of each wire shape: pure allowlist projections shared
// by Enricher (every feed endpoint) and the vote feed read model. Spreading the
// raw manager objects instead would ship every cached internal field
// (registered, ontrial, bio_source, bio_html, lastReadCommentId, ...) to the
// client - TypeScript's structural typing does not strip extra runtime fields.

export const toUserEntity = (user: UserInfo): UserEntity => ({
  id: user.id,
  username: user.username,
  gender: user.gender as unknown as UserGender,
  karma: user.karma,
  name: user.name,
})

export const toUserEntities = (users: Record<number, UserInfo>): Record<number, UserEntity> => {
  const result: Record<number, UserEntity> = {}
  for (const id of Object.keys(users)) {
    result[Number(id)] = toUserEntity(users[Number(id)])
  }
  return result
}

export const toPostEntity = (post: PostInfo): PostEntity => ({
  id: post.id,
  site: post.site,
  title: post.title,
  author: post.author,
  created: post.created.toISOString(),
  content: post.content,
  rating: post.rating,
  comments: post.comments,
  newComments: post.newComments,
  bookmark: post.bookmark,
  watch: post.watch,
  canEdit: post.canEdit,
  editFlag: post.editFlag,
  vote: post.vote,
  language: post.language,
})

export const toCommentEntity = (comment: CommentInfoWithPostData, isNew = comment.isNew): CommentEntity => ({
  id: comment.id,
  author: comment.author,
  content: comment.content,
  created: comment.created.toISOString(),
  deleted: comment.deleted,
  rating: comment.rating,
  parentComment: comment.parentComment,
  editFlag: comment.editFlag,
  post: comment.post,
  site: comment.site,
  canEdit: comment.canEdit,
  isNew,
  vote: comment.vote,
  language: comment.language,
})
