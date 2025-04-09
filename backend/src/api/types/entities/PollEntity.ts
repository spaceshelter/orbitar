import { UserBaseEntity } from './UserEntity'

export interface PollOptionEntity {
  text: string
  votes: number
  voters?: UserBaseEntity[]
}

export interface PollEntity {
  poll_id: number
  author_id: number
  question: string
  options: PollOptionEntity[]
  settings: PollSettingsEntity
  expires_at?: Date
  created_at?: Date
  total_votes: number
  user_vote?: number[]
}

export interface PollVoteEntity {
  vote_id: number
  poll_id: number
  voter_id: number
  option_id: number
  voted_at: string
}

export interface PollSettingsEntity {
  allow_multiple_choice: boolean
  result_visibility: 'always' | 'after_vote' | 'after_vote_end'
  allow_vote_rescinding: boolean
  vote_access: 'everybody' | 'users_with_full_rights'
}
