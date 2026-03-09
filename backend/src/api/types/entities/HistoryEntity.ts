export type HistoryEntity = {
  id: number
  content: string
  encryptedPayloadId?: number
  title?: string
  comment?: string
  date: string
  editor: number
  changed?: number
}
