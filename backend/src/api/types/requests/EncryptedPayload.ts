import { EncryptedPayloadDraftEntity, EncryptedPayloadEntity } from '../entities/EncryptedPayloadEntity'

export type EncryptedPayloadBatchRequest = {
  ids: number[]
}

export type EncryptedPayloadBatchResponse = {
  payloads: EncryptedPayloadEntity[]
}

export type EncryptedPayloadRequestMixin = {
  encryptedPayload?: EncryptedPayloadDraftEntity
}
