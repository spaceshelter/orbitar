import { UserBaseInfo } from '../../../managers/types/UserInfo'

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
