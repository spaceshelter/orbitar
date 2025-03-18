import { PollEntity } from '../entities/PollEntity'

export interface PollVoteRequest {
  poll_id: number
  option_ids: number[]
}

export interface PollVoteResponse {
  poll: PollEntity
}
