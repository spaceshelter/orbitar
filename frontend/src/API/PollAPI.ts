import APIBase from './APIBase'
import {
  CreatePollRequest,
  CreatePollResponse,
  GetPollsBatchRequest,
  GetPollsBatchResponse,
  GetVotersRequest,
  GetVotersResponse,
  PollEntity,
  PollVoteRequest,
  PollVoteResponse,
} from './types/Poll'

export default class PollAPI {
  private api: APIBase

  constructor(api: APIBase) {
    this.api = api
  }

  fixPoll(poll: PollEntity): PollEntity {
    if (poll) {
      // FIXME should not be needed, but backend returns wrong types
      poll.expires = poll.expires ? this.api.fixDate(new Date(poll.expires)) : undefined
    }
    return poll
  }

  async createPoll(data: CreatePollRequest): Promise<CreatePollResponse> {
    return await this.api.request<CreatePollRequest, CreatePollResponse>('/poll/create', data)
  }

  async getPollsBatch(data: GetPollsBatchRequest): Promise<GetPollsBatchResponse> {
    const res = await this.api.request<GetPollsBatchRequest, GetPollsBatchResponse>('/poll/get', data)
    for (const poll of res.polls) {
      this.fixPoll(poll)
    }
    return res
  }

  async vote(data: PollVoteRequest): Promise<PollVoteResponse> {
    const res = await this.api.request<PollVoteRequest, PollVoteResponse>('/poll/vote', data)
    console.log('Vote response:', res)
    return res
  }

  async getVoters(data: GetVotersRequest): Promise<GetVotersResponse> {
    return await this.api.request<GetVotersRequest, GetVotersResponse>('/poll/voters', data)
  }
}
