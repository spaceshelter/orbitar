export type ResultVisibilityRaw = 'always' | 'afterVote' | 'afterVoteEnd'
export type VoteAccessRaw = 'everybody' | 'usersWithFullRights'

export interface PollSettingsRaw {
  allowMultipleChoice: boolean
  resultVisibility: ResultVisibilityRaw
  allowVoteRescinding: boolean
  voteAccess: VoteAccessRaw
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
