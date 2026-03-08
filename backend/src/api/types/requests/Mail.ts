import { MailBatchEntity } from '../entities/MailEntity'

export type MailCreateRequest = {
  toUserId?: number
  toPublicKey?: string
  v: number
  toPayload: string
  fromPayload?: string
}

export type MailCreateResponse = {
  id: number
}

export type MailBatchRequest = {
  ids: number[]
}

export type MailBatchResponse = {
  mails: MailBatchEntity[]
}
