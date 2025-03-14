import { EditFlag } from './common'

export type PostBaseEntity = {
  id: number
  site: string
  title?: string
}

// API entity TokenCounts - matches frontend format
export type TokenCounts = {
  stars: number
  notes: number
  bookmarks: number
}

export type PostEntity = PostBaseEntity & {
  author: number
  created: string
  content?: string
  rating: number
  comments: number
  newComments: number
  bookmark?: boolean
  watch?: boolean
  canEdit?: boolean
  editFlag?: EditFlag
  vote?: number
  language?: string
  // Token counts for markers
  tokenCounts: TokenCounts
}
