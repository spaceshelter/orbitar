export type ResultVisibilityInfo = 'always' | 'afterVote' | 'afterVoteEnd'
export type VoteAccessInfo = 'everybody' | 'usersWithFullRights'

export interface PollSettingsInfo {
  allowMultipleChoice: boolean
  resultVisibility: ResultVisibilityInfo
  allowVoteRescinding: boolean
  voteAccess: VoteAccessInfo
}

export interface PollOptionInfo {
  text: string
  votes: number
}

export interface PollInfo {
  id: number
  author: number
  question: string
  options: PollOptionInfo[]
  settings: PollSettingsInfo
  expires?: Date
  created: Date
  [key: `opt${number}`]: number
  totalVotes: number
  userVotes?: number[]
}
