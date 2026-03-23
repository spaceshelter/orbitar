export type ActivityActionType =
  | 'post:created'
  | 'post:edited'
  | 'comment:created'
  | 'comment:edited'
  | 'vote:post'
  | 'vote:comment'
  | 'vote:karma'
  | 'poll:voted'
  | 'poll:ended'
  | 'site:created'
  | 'user:registered'

export interface ActivityEntry {
  id: number
  type: ActivityActionType
  timestamp: string
  userId: number | null
  username: string | null
  postId?: number | null
  commentId?: number | null
  site?: string | null
  vote?: number | null
  targetUserId?: number | null
  targetUsername?: string | null
  pollId?: number | null
}
