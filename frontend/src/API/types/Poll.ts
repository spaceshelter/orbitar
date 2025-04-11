import { UserBaseInfo } from '@entities/UserInfo'

export enum ResultVisibility {
  ALWAYS = 'always',
  AFTER_VOTE = 'after_vote',
  AFTER_VOTE_END = 'after_vote_end',
}

export enum VoteAccess {
  EVERYBODY = 'everybody',
  USERS_WITH_FULL_RIGHTS = 'users_with_full_rights',
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

export interface CreatePollRequest {
  question: string
  options: string[]
  settings: PollSettingsEntity
  expires?: Date
}

export interface CreatePollResponse {
  id: number
}

export interface GetPollsBatchRequest {
  ids: string[]
}

export interface GetPollsBatchResponse {
  polls: PollEntity[]
}

export interface BackendPollVoteRequest {
  pollId: number
  optionIds: number[]
}

export interface GetVotersRequest {
  pollId: number
  optionId: number
}

export interface GetVotersResponse {
  voters: UserBaseInfo[]
}

export interface PollVoteRequest {
  pollId: number
  optionIds: number[]
}

export interface PollVoteResponse {
  poll: PollEntity
}
