import { PollSettingsEntity } from '../../api/types/entities/PollEntity'

export interface PollRaw {
  poll_id: number
  author_id: number
  question: string
  options: string[]
  settings: PollSettingsEntity
  expires_at?: Date
  created_at: Date
  [key: `opt${number}`]: number
}

export type PollWithUserVoteRaw = PollRaw & {
  user_voted_option_id: number
}
