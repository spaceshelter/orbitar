import { UserBaseInfo } from '../../../managers/types/UserInfo'
import { PollEntity, PollSettingsEntity } from '../entities/PollEntity'

export interface PollCreateRequest {
  question: string
  options: string[]
  settings?: PollSettingsEntity
  expires?: string
}

export interface PollCreateResponse {
  id: number
}

export interface PollVoteRequest {
  pollId: number
  optionIds: number[]
}

export interface PollVoteResponse {
  result: 'voted' | 'rescinded'
}

export interface PollVotersRequest {
  pollId: number
  optionId: number
}

export interface PollVotersResponse {
  voters: UserBaseInfo[]
}

export interface PollBatchRequest {
  ids: number[]
}

export interface PollBatchResponse {
  polls: PollEntity[]
}
