import { UserBaseInfo } from '../../../managers/types/UserInfo'
import { PollEntity, PollSettingsEntity } from '../entities/PollEntity'

export interface PollCreateRequest {
  site: string
  question: string
  options: string[]
  settings?: PollSettingsEntity
  expires_at?: string
}

export interface PollCreateResponse {
  pollId: number
}

export interface PollVoteRequest {
  poll_id: number
  option_ids: number[]
}

export interface PollVoteResponse {
  result: 'voted' | 'rescinded'
}

export interface PollVotersRequest {
  poll_id: number
  option_id: number
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
