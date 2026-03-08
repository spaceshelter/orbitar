export type MailEntity = {
  id: number
  v: number
  fromUserId: number
  toUserId: number
  fromUsername: string
  toUsername: string
  canDecrypt: boolean
  role: 'to' | 'from' | null
  payload?: string
}

export type GetMailsBatchRequest = {
  ids: number[]
}

export type GetMailsBatchResponse = {
  mails: MailEntity[]
}
