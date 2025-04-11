export enum ResultVisibility {
  ALWAYS = 'always',
  AFTER_VOTE = 'afterVote',
  AFTER_VOTE_END = 'afterVoteEnd',
}

export enum VoteAccess {
  EVERYBODY = 'everybody',
  USERS_WITH_FULL_RIGHTS = 'usersWithFullRights',
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
  id: string
  author: string
  question: string
  options: PollOptionEntity[]
  settings: PollSettingsEntity
  expires?: Date
  created?: Date
  totalVotes: number
  userVotes?: string[]
}
