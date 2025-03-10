export enum MarkerTargetType {
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

export enum MarkerType {
  POST_DEFAULT = 'post_default',
  POST_STAR = 'post_star',
  POST_NOTE = 'post_note',
  POST_BOOKMARK = 'post_bookmark',
  COMMENT_DEFAULT = 'comment_default',
  COMMENT_STAR = 'comment_star',
  COMMENT_NOTE = 'comment_note',
  COMMENT_BOOKMARK = 'comment_bookmark',
  USER_DEFAULT = 'user_default',
  USER_STAR = 'user_star',
  USER_NOTE = 'user_note',
  USER_BOOKMARK = 'user_bookmark',
}

export interface MarkerInfo {
  markerId: number
  creatorId: number
  postId: number | null
  commentId: number | null
  userId: number | null
  markerType: string
  placedCount: number
  createdAt: Date
  removedAt: Date | null
  annotation: string | null
}

export interface TokenCounter {
  count: number
  star_count: number
  note_count: number
  bookmark_count: number
}

export interface UserTokenInfo {
  availableTokens: number
  maxTokens: number
  history: MarkerInfo[]
}
