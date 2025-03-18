import { PollEntity } from '../entities/PollEntity'

export interface PollCreateRequest {
  post_id: number
  question: string
  options: string[]
  settings?: {
    multiple_choice?: boolean
    hide_results?: boolean
  }
  expires_at?: string
}

export interface PollCreateResponse {
  poll: PollEntity
}
