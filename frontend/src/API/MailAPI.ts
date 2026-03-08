import APIBase from './APIBase'
import { GetMailsBatchRequest, GetMailsBatchResponse } from './types/Mail'

export default class MailAPI {
  private api: APIBase

  constructor(api: APIBase) {
    this.api = api
  }

  async getMailsBatch(data: GetMailsBatchRequest): Promise<GetMailsBatchResponse> {
    return await this.api.request<GetMailsBatchRequest, GetMailsBatchResponse>('/mail/get', data)
  }
}
