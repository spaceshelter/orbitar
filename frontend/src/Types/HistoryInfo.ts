export type HistoryInfo = {
  id: number
  content: string
  encryptedPayloadId?: number
  title?: string
  comment?: string
  date: Date
  changed: number
  editor: number
}
