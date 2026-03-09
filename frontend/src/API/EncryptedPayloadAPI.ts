import { EncryptedPayloadEntity } from '@utils/mailCrypto'

import APIBase from './APIBase'

type EncryptedPayloadBatchRequest = {
  ids: number[]
}

type EncryptedPayloadBatchResponse = {
  payloads: EncryptedPayloadEntity[]
}

export default class EncryptedPayloadAPI {
  api: APIBase

  constructor(api: APIBase) {
    this.api = api
  }

  getPayloadsBatch(data: EncryptedPayloadBatchRequest) {
    return this.api.request<EncryptedPayloadBatchRequest, EncryptedPayloadBatchResponse>('/encrypted-payload/get', data)
  }
}
