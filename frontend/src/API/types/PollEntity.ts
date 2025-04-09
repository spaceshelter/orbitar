export interface PollOptionEntity {
  text: string
  votes: number
}

export interface PollEntity {
  poll_id: number
  author_id: number
  question: string
  options: PollOptionEntity[]
  settings: {
    multiple_choice?: boolean
    hide_results?: boolean
  }
  expires_at?: Date
  created_at?: Date
  total_votes: number
  user_vote?: number[]
}
