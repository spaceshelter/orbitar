export enum MarkerTargetType {
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

export enum MarkerType {
  STAR = 'star',
  NOTE = 'note',
  BOOKMARK = 'bookmark',
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
