import { Poll, PollVoteRequest, PollVoteResponse } from '../Types/Poll'
import APIBase from './APIBase'

export interface CreatePollRequest {
  post_id: number
  question: string
  options: string[]
  settings: {
    multiple_choice?: boolean
    hide_results?: boolean
  }
  expires_at?: string
}

export interface CreatePollResponse {
  poll: Poll
}

export interface GetPollRequest {
  poll_id: number
}

export interface GetPollResponse {
  poll: Poll
}

export interface GetPollsBatchRequest {
  ids: number[]
}

export interface GetPollsBatchResponse {
  polls: Poll[]
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

  async getPoll(data: GetPollRequest): Promise<GetPollResponse> {
    return await this.api.request<GetPollRequest, GetPollResponse>(`/poll/${data.poll_id}`, data)
  }

  async getPollsBatch(data: GetPollsBatchRequest): Promise<GetPollsBatchResponse> {
    return await this.api.request<GetPollsBatchRequest, GetPollsBatchResponse>('/polls/batch', data)
  }

  async vote(data: PollVoteRequest): Promise<PollVoteResponse> {
    return await this.api.request<PollVoteRequest, PollVoteResponse>('/poll/vote', data)
  }
}
