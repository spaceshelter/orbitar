export type MailInfo = {
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
