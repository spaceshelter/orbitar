import { UserBaseInfo } from '@entities/UserInfo'

export enum ResultVisibility {
  ALWAYS = 'always',
  AFTER_VOTE = 'afterVote',
  AFTER_VOTE_END = 'afterVoteEnd',
}

export enum VoteAccess {
  EVERYBODY = 'everybody',
  USERS_WITH_FULL_RIGHTS = 'usersWithFullRights',
}

export interface PollOptionEntity {
  text: string
  votes: number
}

export interface PollSettingsEntity {
  allowMultipleChoice: boolean
  allowVoteRescinding: boolean
  voteAccess: VoteAccess
  resultVisibility: ResultVisibility
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

export interface CreatePollRequest {
  question: string
  options: string[]
  settings: PollSettingsEntity
  expires?: Date
}

export interface CreatePollResponse {
  id: string
}

export interface GetPollsBatchRequest {
  ids: string[]
}

export interface GetPollsBatchResponse {
  polls: PollEntity[]
}

export interface BackendPollVoteRequest {
  pollId: string
  optionIds: string[]
}

export interface GetVotersRequest {
  pollId: string
  optionId: string
}

export interface GetVotersResponse {
  voters: UserBaseInfo[]
}

export interface PollVoteRequest {
  pollId: string
  optionIds: string[]
}

export interface PollVoteResponse {
  poll: PollEntity
}
