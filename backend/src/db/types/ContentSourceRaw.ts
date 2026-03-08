export type ContentSourceRaw = {
  content_source_id: number
  ref_id: number
  ref_type: string
  author_id: number
  source: string
  encrypted_payload_id?: number | null
  title?: string
  comment?: string
  created_at: Date
}
