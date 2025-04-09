import { UserBaseInfo } from '@entities/UserInfo'

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
  expires_at?: Date
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

export interface GetVotersRequest {
  poll_id: number
  option_id: number
}

export interface GetVotersResponse {
  voters: UserBaseInfo[]
}
export class PollAPI {
  private api: APIBase

  constructor(api: APIBase) {
    this.api = api
  }

  fixPoll(poll: PollBackendResponse): PollBackendResponse {
    if (poll) {
      // FIXME should not be needed, but backend returns wrong types
      poll.expires_at = poll.expires_at ? this.api.fixDate(new Date(poll.expires_at)) : undefined
    }
    return poll
  }

  async createPoll(data: CreatePollRequest): Promise<CreatePollResponse> {
    return await this.api.request<CreatePollRequest, CreatePollResponse>('/poll/create', data)
  }

  async getPollsBatch(data: GetPollsBatchRequest): Promise<GetPollsBatchResponse> {
    const res = await this.api.request<GetPollsBatchRequest, GetPollsBatchResponse>('/polls', data)
    for (const poll of res.polls) {
      this.fixPoll(poll)
    }
    return res
  }

  async vote(data: PollVoteRequest): Promise<PollVoteResponse> {
    const res = await this.api.request<PollVoteRequest, PollVoteResponse>('/poll/vote', data)
    console.log('Vote response:', res)
    this.fixPoll(res.poll)
    return res
  }

  async getVoters(data: GetVotersRequest): Promise<GetVotersResponse> {
    return await this.api.request<GetVotersRequest, GetVotersResponse>('/poll/voters', data)
  }
}
