export interface PollRaw {
  poll_id: number
  question: string
  created_at: Date
  option_id: number
  text: string
}

export type PollWithUserVoteRaw = PollRaw & {
  user_voted_option_id: number
}
