export interface MarkerRaw {
  marker_id: number
  creator_id: number
  post_id: number | null
  comment_id: number | null
  user_id: number | null
  marker_type: string
  placed_count: number
  created_at: Date
  removed_at: Date | null
  annotation: string | null
}
