export type ResultVisibility = 'always' | 'afterVote' | 'afterVoteEnd'
export type VoteAccess = 'everybody' | 'usersWithFullRights'
export interface PollSettingsEntity {
  allowMultipleChoice: boolean
  resultVisibility: ResultVisibility
  allowVoteRescinding: boolean
  voteAccess: VoteAccess
}

export interface PollOptionEntity {
  text: string
  votes: number
}

export interface PollEntity {
  id: number
  author: number
  question: string
  options: PollOptionEntity[]
  settings: PollSettingsEntity
  expires?: Date
  created?: Date
  totalVotes: number
  userVotes?: number[]
}

export interface PollVoteEntity {
  voteId: number
  pollId: number
  voterId: number
  optionId: number
  votedAt: string
}
