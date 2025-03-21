import { PollEntity, PollSettingsEntity } from '../entities/PollEntity'

export interface PollCreateRequest {
  post_id: number
  question: string
  options: string[]
  settings?: PollSettingsEntity
  expires_at?: string
}

export interface PollCreateResponse {
  poll: PollEntity
}
