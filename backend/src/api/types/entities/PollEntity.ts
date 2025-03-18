export interface PollOptionEntity {
  text: string
  votes: number
}

export interface PollEntity {
  poll_id: number
  author_id: number
  site_id: number
  question: string
  options: PollOptionEntity[]
  settings: {
    multiple_choice?: boolean
    hide_results?: boolean
  }
  expires_at: string | null
  created_at: string
  total_votes: number
  user_vote?: number[]
}

export interface PollVoteEntity {
  vote_id: number
  poll_id: number
  voter_id: number
  option_id: number
  voted_at: string
}
