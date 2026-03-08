export type MailRaw = {
  mail_id: number
  created_at: Date
  from_user_id: number
  to_user_id: number | null
  post_id?: number
  comment_id?: number
  v: number
  to_payload: string
  from_payload?: string
}

export type MailBatchRaw = MailRaw & {
  from_username: string
  to_username?: string
}
