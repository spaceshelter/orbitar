import APIBase from './APIBase'
import { CreateMailRequest, CreateMailResponse, GetMailsBatchRequest, GetMailsBatchResponse } from './types/Mail'

export default class MailAPI {
  private api: APIBase

  constructor(api: APIBase) {
    this.api = api
  }

  async createMail(data: CreateMailRequest): Promise<CreateMailResponse> {
    return await this.api.request<CreateMailRequest, CreateMailResponse>('/mail/create', data)
  }

  async getMailsBatch(data: GetMailsBatchRequest): Promise<GetMailsBatchResponse> {
    return await this.api.request<GetMailsBatchRequest, GetMailsBatchResponse>('/mail/get', data)
  }
}
