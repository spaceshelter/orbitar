export interface PollVoteRequest {
  poll_id: number
  option_ids: number[]
}

export interface PollVoteResponse {
  result: 'voted' | 'rescinded'
}
