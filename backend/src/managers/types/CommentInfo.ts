import { EditFlag } from './common'
import { TokenCounts } from './TokenCounts'

export type CommentBaseInfo = {
  id: number
  content: string
}

export type CommentInfo = CommentBaseInfo & {
  author: number
  created: Date
  deleted?: boolean
  rating: number
  parentComment?: number

  isNew?: boolean
  vote?: number
  answers?: CommentInfo[]
  canEdit?: boolean
  editFlag?: EditFlag

  language?: string

  // Token counts
  tokenCounts: TokenCounts
}

export type CommentInfoWithPostData = CommentInfo & {
  post: number
  site: string
}
