export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface PollBackendResponse {
  poll_id: number
  question: string
  options: PollOption[]
  total_votes: number
  user_vote?: number[]
  settings: PollBackendSettingsEntity
  expires_at?: Date
}

export interface Poll {
  id: string
  question: string
  options: PollOption[]
  totalVotes: number
  userVoted?: number[]
  settings: PollSettings
}

export interface PollSettings {
  allowMultipleVotes: boolean
  resultVisibility: 'always' | 'after_vote' | 'after_vote_end'
  allowVoteRescinding: boolean
  voteAccess: 'everybody' | 'users_with_full_rights'
  expiresAt?: Date
}

export interface PollVoteRequest {
  poll_id: number
  option_ids: number[]
}

export interface PollVoteResponse {
  success: boolean
  poll: PollBackendResponse
}
export interface PollBackendSettingsEntity {
  allow_multiple_choice: boolean
  result_visibility: 'always' | 'after_vote' | 'after_vote_end'
  allow_vote_rescinding: boolean
  vote_access: 'everybody' | 'users_with_full_rights'
}
