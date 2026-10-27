import { ActivityEntry } from '../entities/ActivityEntity'

export interface ActivityFeedRequest {
  after_id?: number
  limit?: number
}

export interface ActivityFeedResponse {
  entries: ActivityEntry[]
  oldestId: number | null
  newestId: number | null
  limit: number
}
