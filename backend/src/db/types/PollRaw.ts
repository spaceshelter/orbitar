export type ResultVisibilityRaw = 'always' | 'after_vote' | 'after_vote_end'
export type VoteAccessRaw = 'everybody' | 'users_with_full_rights'

export interface PollSettingsRaw {
  allow_multiple_choice: boolean
  result_visibility: ResultVisibilityRaw
  allow_vote_rescinding: boolean
  vote_access: VoteAccessRaw
}

export interface PollRaw {
  poll_id: number
  author_id: number
  question: string
  options: string[]
  settings: PollSettingsRaw
  expires_at?: Date
  created_at: Date
  [key: `opt${number}`]: number
}

export type PollWithUserVoteRaw = PollRaw & {
  user_voted_option_id: number
}
