import {
  PollBackendResponse,
  PollRescindVoteRequest,
  PollRescindVoteResponse,
  PollVoteRequest,
  PollVoteResponse,
} from '../Types/Poll'
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
  poll: PollBackendResponse
}

export interface GetPollRequest {
  poll_id: number
}

export interface GetPollResponse {
  poll: PollBackendResponse
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

  async getPoll(data: GetPollRequest): Promise<GetPollResponse> {
    return await this.api.request<GetPollRequest, GetPollResponse>(`/poll/${data.poll_id}`, data)
  }

  async getPollsBatch(data: GetPollsBatchRequest): Promise<GetPollsBatchResponse> {
    return await this.api.request<GetPollsBatchRequest, GetPollsBatchResponse>('/polls/batch', data)
  }

  async vote(data: PollVoteRequest): Promise<PollVoteResponse> {
    return await this.api.request<PollVoteRequest, PollVoteResponse>('/poll/vote', data)
  }

  async rescindVote(data: PollRescindVoteRequest): Promise<PollRescindVoteResponse> {
    return await this.api.request<PollRescindVoteRequest, PollRescindVoteResponse>('/poll/rescind', data)
  }
}
