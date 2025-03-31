import { PollEntity, PollSettingsEntity } from '../entities/PollEntity'

export interface PollCreateRequest {
  site: string
  question: string
  options: string[]
  settings?: PollSettingsEntity
  expires_at?: string
}

export interface PollCreateResponse {
  poll: PollEntity
}
