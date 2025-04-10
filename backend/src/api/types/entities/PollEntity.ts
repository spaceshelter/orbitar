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
  id: string
  author: string
  question: string
  options: PollOptionEntity[]
  settings: PollSettingsEntity
  expires?: Date
  created?: Date
  totalVotes: number
  userVotes?: number[]
}

export interface PollVoteEntity {
  voteId: string
  pollId: string
  voterId: string
  optionId: string
  voted: string
}
