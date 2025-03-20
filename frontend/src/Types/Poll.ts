export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface PollBackendResponse {
  poll_id: string | number
  question: string
  options: PollOption[]
  total_votes: number
  user_vote?: number[]
  settings: {
    multiple_choice?: boolean
    hide_results?: boolean
  }
  expires_at?: string
}

export interface Poll {
  id: string
  poll_id: string
  question: string
  options: PollOption[]
  totalVotes: number
  userVoted?: string
  settings: {
    allowMultipleVotes: boolean
    showResults: boolean
    expiresAt?: string
  }
}

export interface PollVoteRequest {
  poll_id: number
  option_ids: number[]
}

export interface PollVoteResponse {
  success: boolean
  poll: PollBackendResponse
}
