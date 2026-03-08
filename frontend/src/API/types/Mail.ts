export type MailEntity = {
  id: number
  v: number
  fromUserId?: number
  toUserId?: number
  fromUsername?: string
  toUsername?: string
  canDecrypt: boolean
  role: 'to' | 'from' | 'public' | null
  payload?: string
}

export type CreateMailRequest = {
  toUserId?: number
  toPublicKey?: string
  v: number
  toPayload: string
  fromPayload?: string
}

export type CreateMailResponse = {
  id: number
}

export type GetMailsBatchRequest = {
  ids: number[]
}

export type GetMailsBatchResponse = {
  mails: MailEntity[]
}
