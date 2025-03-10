import DB from '../DB'
import { MarkerRaw } from '../types/MarkerRaw'

export class MarkerRepository {
  db: DB

  constructor(db: DB) {
    this.db = db
  }

  /**
   * Creates a marker with the specified target and marker type
   */
  async createMarker({
    creatorId,
    targetId,
    markerType,
    placedCount = 1,
    annotation = null,
  }: {
    creatorId: number
    targetId: number
    markerType: string
    placedCount?: number
    annotation?: string | null
  }): Promise<MarkerRaw> {
    let postId = null
    let commentId = null
    let userId = null

    // Set the appropriate ID field based on marker type
    if (markerType.startsWith('post')) {
      postId = targetId
    } else if (markerType.startsWith('comment')) {
      commentId = targetId
    } else if (markerType.startsWith('user')) {
      userId = targetId
    }

    const result = await this.db.query<{ insertId: number }>(
      `INSERT INTO markers 
      (creator_id, post_id, comment_id, user_id, marker_type, placed_count, annotation)
      VALUES (:creatorId, :postId, :commentId, :userId, :markerType, :placedCount, :annotation)
      ON DUPLICATE KEY UPDATE 
        placed_count = :placedCount,
        annotation = :annotation,
        marker_type = :markerType,
        removed_at = NULL,
        created_at = CURRENT_TIMESTAMP`,
      {
        creatorId,
        postId,
        commentId,
        userId,
        markerType,
        placedCount,
        annotation,
      },
    )

    // Update the relevant counter
    if (postId) {
      await this.updatePostCounter({ postId, markerType, change: 1 })
    } else if (commentId) {
      await this.updateCommentCounter({ commentId, markerType, change: 1 })
    } else if (userId) {
      await this.updateUserCounter({ userId, markerType, change: 1 })
    }

    return this.getMarkerById({ markerId: result.insertId })
  }

  async removeMarker({ markerId }: { markerId: number }): Promise<void> {
    // Get the marker first to know what counter to update
    const marker = await this.getMarkerById({ markerId })
    if (!marker) return

    // Mark as removed, but keep the record
    await this.db.query(
      `UPDATE markers SET removed_at = CURRENT_TIMESTAMP, placed_count = 0 WHERE marker_id = :markerId`,
      { markerId },
    )

    // Update the relevant counter
    if (marker.post_id) {
      await this.updatePostCounter({ postId: marker.post_id, markerType: marker.marker_type, change: -1 })
    } else if (marker.comment_id) {
      await this.updateCommentCounter({ commentId: marker.comment_id, markerType: marker.marker_type, change: -1 })
    } else if (marker.user_id) {
      await this.updateUserCounter({ userId: marker.user_id, markerType: marker.marker_type, change: -1 })
    }
  }

  private async updatePostCounter({
    postId,
    markerType,
    change,
  }: {
    postId: number
    markerType: string
    change: number
  }): Promise<void> {
    // Update specific counter based on marker type
    if (markerType.includes('star')) {
      await this.db.query(`UPDATE posts SET star_count = GREATEST(0, star_count + :change) WHERE post_id = :postId`, {
        change,
        postId,
      })
    } else if (markerType.includes('note')) {
      await this.db.query(`UPDATE posts SET note_count = GREATEST(0, note_count + :change) WHERE post_id = :postId`, {
        change,
        postId,
      })
    } else if (markerType.includes('bookmark')) {
      await this.db.query(
        `UPDATE posts SET bookmark_count = GREATEST(0, bookmark_count + :change) WHERE post_id = :postId`,
        { change, postId },
      )
    }
  }

  private async updateCommentCounter({
    commentId,
    markerType,
    change,
  }: {
    commentId: number
    markerType: string
    change: number
  }): Promise<void> {
    // Update specific counter based on marker type
    if (markerType.includes('star')) {
      await this.db.query(
        `UPDATE comments SET star_count = GREATEST(0, star_count + :change) WHERE comment_id = :commentId`,
        { change, commentId },
      )
    } else if (markerType.includes('note')) {
      await this.db.query(
        `UPDATE comments SET note_count = GREATEST(0, note_count + :change) WHERE comment_id = :commentId`,
        { change, commentId },
      )
    } else if (markerType.includes('bookmark')) {
      await this.db.query(
        `UPDATE comments SET bookmark_count = GREATEST(0, bookmark_count + :change) WHERE comment_id = :commentId`,
        { change, commentId },
      )
    }
  }

  private async updateUserCounter({
    userId,
    markerType,
    change,
  }: {
    userId: number
    markerType: string
    change: number
  }): Promise<void> {
    // Update specific counter based on marker type
    if (markerType.includes('star')) {
      await this.db.query(`UPDATE users SET star_count = GREATEST(0, star_count + :change) WHERE user_id = :userId`, {
        change,
        userId,
      })
    } else if (markerType.includes('note')) {
      await this.db.query(`UPDATE users SET note_count = GREATEST(0, note_count + :change) WHERE user_id = :userId`, {
        change,
        userId,
      })
    } else if (markerType.includes('bookmark')) {
      await this.db.query(
        `UPDATE users SET bookmark_count = GREATEST(0, bookmark_count + :change) WHERE user_id = :userId`,
        { change, userId },
      )
    }
  }

  async getMarkerById({ markerId }: { markerId: number }): Promise<MarkerRaw | null> {
    const rows = await this.db.fetchAll<MarkerRaw>('SELECT * FROM markers WHERE marker_id = :markerId', { markerId })

    return rows.length ? rows[0] : null
  }

  async getMarker({
    targetId,
    creatorId,
    markerType,
  }: {
    targetId: number
    creatorId: number
    markerType: string
  }): Promise<MarkerRaw | null> {
    let field = ''

    if (markerType.startsWith('post')) {
      field = 'post_id'
    } else if (markerType.startsWith('comment')) {
      field = 'comment_id'
    } else if (markerType.startsWith('user')) {
      field = 'user_id'
    } else {
      return null
    }

    const rows = await this.db.fetchAll<MarkerRaw>(
      `SELECT * FROM markers 
       WHERE ${field} = :targetId 
       AND creator_id = :creatorId 
       AND marker_type = :markerType 
       AND removed_at IS NULL`,
      { targetId, creatorId, markerType },
    )

    return rows.length ? rows[0] : null
  }

  async getMarkers({
    targetId,
    targetType,
    markerType,
    includeRemoved = false,
  }: {
    targetId: number
    targetType: 'post' | 'comment' | 'user'
    markerType?: string
    includeRemoved?: boolean
  }): Promise<MarkerRaw[]> {
    const removedFilter = includeRemoved ? '' : 'AND removed_at IS NULL'
    const field = `${targetType}_id`
    const typeFilter = markerType ? `AND marker_type = :markerType` : ''

    const params: any = { targetId }
    if (markerType) {
      params.markerType = markerType
    }

    return this.db.fetchAll<MarkerRaw>(
      `SELECT * FROM markers 
       WHERE ${field} = :targetId ${typeFilter} ${removedFilter}
       ORDER BY created_at DESC`,
      params,
    )
  }

  async getMarkersByCreator({
    creatorId,
    markerType,
    includeRemoved = false,
  }: {
    creatorId: number
    markerType?: string
    includeRemoved?: boolean
  }): Promise<MarkerRaw[]> {
    const removedFilter = includeRemoved ? '' : 'AND removed_at IS NULL'
    const typeFilter = markerType ? `AND marker_type = :markerType` : ''

    const params: any = { creatorId }
    if (markerType) {
      params.markerType = markerType
    }

    return this.db.fetchAll<MarkerRaw>(
      `SELECT * FROM markers 
       WHERE creator_id = :creatorId ${typeFilter} ${removedFilter}
       ORDER BY created_at DESC`,
      params,
    )
  }

  /**
   * Gets markers created by a user within a specified time period
   */
  async getMarkersByCreatorInTimePeriod({
    creatorId,
    startDate,
    endDate,
    markerType,
    includeRemoved = false,
  }: {
    creatorId: number
    startDate: Date
    endDate: Date
    markerType?: string
    includeRemoved?: boolean
  }): Promise<MarkerRaw[]> {
    const removedFilter = includeRemoved ? '' : 'AND removed_at IS NULL'
    const typeFilter = markerType ? `AND marker_type = :markerType` : ''

    const params: any = { creatorId, startDate, endDate }
    if (markerType) {
      params.markerType = markerType
    }

    return this.db.fetchAll<MarkerRaw>(
      `SELECT * FROM markers 
       WHERE creator_id = :creatorId 
       AND created_at >= :startDate 
       AND created_at <= :endDate 
       ${typeFilter} ${removedFilter}
       ORDER BY created_at DESC`,
      params,
    )
  }

  async getMarkerCounts({
    postId = null,
    commentId = null,
    userId = null,
    markerType,
  }: {
    postId?: number | null
    commentId?: number | null
    userId?: number | null
    markerType?: string
  }): Promise<{ count: number; star_count: number; note_count: number; bookmark_count: number }> {
    let query = ''
    const params: any = {}
    let typeFilter = ''
    let specificCountRequested = false

    if (markerType) {
      typeFilter = 'AND marker_type = :markerType'
      specificCountRequested = true
      params.markerType = markerType
    }

    if (postId) {
      if (specificCountRequested) {
        query = `SELECT COUNT(*) as count FROM markers WHERE post_id = :postId ${typeFilter} AND removed_at IS NULL`
        params.postId = postId
      } else {
        query =
          'SELECT star_count, note_count, bookmark_count, (star_count + note_count + bookmark_count) as count FROM posts WHERE post_id = :postId'
        params.postId = postId
      }
    } else if (commentId) {
      if (specificCountRequested) {
        query = `SELECT COUNT(*) as count FROM markers WHERE comment_id = :commentId ${typeFilter} AND removed_at IS NULL`
        params.commentId = commentId
      } else {
        query =
          'SELECT star_count, note_count, bookmark_count, (star_count + note_count + bookmark_count) as count FROM comments WHERE comment_id = :commentId'
        params.commentId = commentId
      }
    } else if (userId) {
      if (specificCountRequested) {
        query = `SELECT COUNT(*) as count FROM markers WHERE user_id = :userId ${typeFilter} AND removed_at IS NULL`
        params.userId = userId
      } else {
        query =
          'SELECT star_count, note_count, bookmark_count, (star_count + note_count + bookmark_count) as count FROM users WHERE user_id = :userId'
        params.userId = userId
      }
    } else {
      return { count: 0, star_count: 0, note_count: 0, bookmark_count: 0 }
    }

    const rows = await this.db.fetchAll<{
      count: number
      star_count?: number
      note_count?: number
      bookmark_count?: number
    }>(query, params)

    // Make sure all fields are defined
    const result = rows.length ? rows[0] : { count: 0 }

    return {
      count: result.count || 0,
      star_count: result.star_count || 0,
      note_count: result.note_count || 0,
      bookmark_count: result.bookmark_count || 0,
    }
  }

  async getRecentTokenHistory({
    userId,
    markerType,
    limit = 20,
  }: {
    userId: number
    markerType?: string
    limit?: number
  }): Promise<MarkerRaw[]> {
    const typeFilter = markerType ? `AND marker_type = :markerType` : ''
    const params: any = { userId, limit }
    if (markerType) {
      params.markerType = markerType
    }

    return this.db.fetchAll<MarkerRaw>(
      `SELECT * FROM markers 
       WHERE creator_id = :userId ${typeFilter}
       ORDER BY 
         CASE 
           WHEN removed_at IS NOT NULL THEN removed_at
           ELSE created_at
         END DESC
       LIMIT :limit`,
      params,
    )
  }
}
