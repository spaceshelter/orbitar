import { PollEntity } from '../entities/PollEntity'

export interface PollGetRequest {
  poll_id: number
}

export interface PollGetResponse {
  poll: PollEntity
}

export interface PollListRequest {
  site_id: number
  limit?: number
  offset?: number
  active_only?: boolean
}

export interface PollListResponse {
  polls: PollEntity[]
  total: number
}
