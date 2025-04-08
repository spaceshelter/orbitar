import { PollBackendResponse, PollVoteRequest, PollVoteResponse } from '../Types/Poll'
import APIBase from './APIBase'

export interface CreatePollRequest {
  question: string
  options: string[]
  settings: {
    allow_multiple_choice?: boolean
    result_visibility?: 'always' | 'after_vote' | 'after_vote_end'
    allow_vote_rescinding?: boolean
    vote_access?: 'everybody' | 'users_with_full_rights'
  }
  expires_at?: string
}

export interface CreatePollResponse {
  pollId: number
}

export interface GetPollsBatchRequest {
  ids: number[]
}

export interface GetPollsBatchResponse {
  polls: PollBackendResponse[]
}

export interface BackendPollVoteRequest {
  poll_id: number
  option_ids: number[]
}

export class PollAPI {
  private api: APIBase

  constructor(api: APIBase) {
    this.api = api
  }

  async createPoll(data: CreatePollRequest): Promise<CreatePollResponse> {
    return await this.api.request<CreatePollRequest, CreatePollResponse>('/poll/create', data)
  }

  async getPollsBatch(data: GetPollsBatchRequest): Promise<GetPollsBatchResponse> {
    return await this.api.request<GetPollsBatchRequest, GetPollsBatchResponse>('/polls', data)
  }

  async vote(data: PollVoteRequest): Promise<PollVoteResponse> {
    return await this.api.request<PollVoteRequest, PollVoteResponse>('/poll/vote', data)
  }
}
