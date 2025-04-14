export enum ResultVisibility {
  ALWAYS = 'always',
  AFTER_VOTE = 'after_vote',
  AFTER_VOTE_END = 'after_vote_end',
}

export enum VoteAccess {
  EVERYBODY = 'everybody',
  USERS_WITH_FULL_RIGHTS = 'users_with_full_rights',
}

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
  canShowResults: boolean
}
