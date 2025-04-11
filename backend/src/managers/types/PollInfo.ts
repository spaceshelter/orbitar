import { ResultVisibility, VoteAccess } from '../../api/types/entities/PollEntity'

export interface PollSettingsInfo {
  allowMultipleChoice: boolean
  resultVisibility: ResultVisibility
  allowVoteRescinding: boolean
  voteAccess: VoteAccess
}

export interface PollOptionInfo {
  text: string
  votes: number
}

export interface PollInfo {
  id: string
  author: string
  question: string
  options: PollOptionInfo[]
  settings: PollSettingsInfo
  expires?: Date
  created: Date
  [key: `opt${number}`]: number
  totalVotes: number
  userVotes?: string[]
}
