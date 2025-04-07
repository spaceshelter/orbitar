import { MarkerTargetType, MarkerType } from '../../managers/types/MarkerInfo'
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
    targetType,
    markerType,
    placedCount = 1,
    annotation = null,
  }: {
    creatorId: number
    targetId: number
    targetType: MarkerTargetType
    markerType: MarkerType
    placedCount?: number
    annotation?: string | null
  }): Promise<MarkerRaw> {
    let postId = null
    let commentId = null
    let userId = null

    // Set the appropriate ID field based on target type
    switch (targetType) {
      case MarkerTargetType.POST:
        postId = targetId
        break
      case MarkerTargetType.COMMENT:
        commentId = targetId
        break
      case MarkerTargetType.USER:
        userId = targetId
        break
      default:
        throw new Error(`Invalid target type: ${targetType}`)
    }

    // First, check if there's already a marker for this (creator, type, target) combination
    let existingMarker: MarkerRaw | null = null
    let whereClause = 'creator_id = :creatorId AND marker_type = :markerType AND removed_at IS NULL'
    const queryParams: any = {
      creatorId,
      markerType,
    }

    if (postId) {
      whereClause += ' AND post_id = :targetId AND comment_id IS NULL AND user_id IS NULL'
      queryParams.targetId = postId
    } else if (commentId) {
      whereClause += ' AND post_id IS NULL AND comment_id = :targetId AND user_id IS NULL'
      queryParams.targetId = commentId
    } else if (userId) {
      whereClause += ' AND post_id IS NULL AND comment_id IS NULL AND user_id = :targetId'
      queryParams.targetId = userId
    }

    const existingRows = await this.db.fetchAll<MarkerRaw>(`SELECT * FROM markers WHERE ${whereClause}`, queryParams)

    if (existingRows.length > 0) {
      existingMarker = existingRows[0]
    }

    let result: any
    let updatedPlacedCount = placedCount
    let markerId: number

    if (existingMarker) {
      // If there's an existing marker, handle based on marker type
      if (markerType === MarkerType.BOOKMARK) {
        // For bookmarks, just update the annotation and ensure placed_count is 1
        updatedPlacedCount = 1
      } else {
        // For other types (STAR, NOTE), increment the placed_count
        updatedPlacedCount = existingMarker.placed_count + placedCount
      }

      // Update the existing marker
      await this.db.query(
        `UPDATE markers
         SET placed_count = :updatedPlacedCount,
             annotation = :annotation,
             removed_at = NULL,
             created_at = CURRENT_TIMESTAMP
         WHERE marker_id = :markerId`,
        {
          markerId: existingMarker.marker_id,
          updatedPlacedCount,
          annotation,
        },
      )
      markerId = existingMarker.marker_id
    } else {
      // No existing marker, create a new one
      result = await this.db.query<{ insertId: number }>(
        `INSERT INTO markers 
        (creator_id, post_id, comment_id, user_id, marker_type, placed_count, annotation)
        VALUES (:creatorId, :postId, :commentId, :userId, :markerType, :placedCount, :annotation)`,
        {
          creatorId,
          postId,
          commentId,
          userId,
          markerType,
          placedCount: markerType === MarkerType.BOOKMARK ? 1 : placedCount, // Ensure bookmarks always have placed_count=1
          annotation,
        },
      )
      markerId = result.insertId
    }

    // Update the relevant counter
    // If updating an existing marker, only update counters by the difference
    const counterChange = existingMarker
      ? updatedPlacedCount - existingMarker.placed_count
      : markerType === MarkerType.BOOKMARK
        ? 1
        : placedCount

    if (counterChange !== 0) {
      if (postId) {
        await this.updatePostCounter({ postId, markerType, change: counterChange })
      } else if (commentId) {
        await this.updateCommentCounter({ commentId, markerType, change: counterChange })
      } else if (userId) {
        await this.updateUserCounter({ userId, markerType, change: counterChange })
      }
    }

    return this.getMarkerById({ markerId })
  }

  async removeMarker({ markerId }: { markerId: number }): Promise<void> {
    // Get the marker first to know what counter to update
    const marker = await this.getMarkerById({ markerId })
    if (!marker) return

    // For bookmarks, we always remove them immediately
    // For other types, we decrement the placed_count and only mark as removed when it reaches 0
    const isBookmark = marker.marker_type === MarkerType.BOOKMARK

    if (isBookmark || marker.placed_count <= 1) {
      // Mark as removed and set placed_count to 0
      await this.db.query(
        `UPDATE markers SET removed_at = CURRENT_TIMESTAMP, placed_count = 0 WHERE marker_id = :markerId`,
        { markerId },
      )
    } else {
      // Decrement placed_count but don't mark as removed
      await this.db.query(`UPDATE markers SET placed_count = placed_count - 1 WHERE marker_id = :markerId`, {
        markerId,
      })
    }

    // Update the relevant counter (always decrement by 1)
    if (marker.post_id) {
      await this.updatePostCounter({ postId: marker.post_id, markerType: marker.marker_type as MarkerType, change: -1 })
    } else if (marker.comment_id) {
      await this.updateCommentCounter({
        commentId: marker.comment_id,
        markerType: marker.marker_type as MarkerType,
        change: -1,
      })
    } else if (marker.user_id) {
      await this.updateUserCounter({ userId: marker.user_id, markerType: marker.marker_type as MarkerType, change: -1 })
    }
  }

  /**
   * Generic counter update method that handles all entity types
   */
  private async updateEntityCounter({
    entityType,
    entityId,
    markerType,
    change,
  }: {
    entityType: 'post' | 'comment' | 'user'
    entityId: number
    markerType: MarkerType
    change: number
  }): Promise<void> {
    // Determine the table name and ID column based on entity type
    const tableName = entityType === 'post' ? 'posts' : entityType === 'comment' ? 'comments' : 'users'
    const idColumn = `${entityType}_id`

    // Determine the counter field based on marker type
    const counterField = `${markerType.toLowerCase()}_count`

    // Build and execute the query
    await this.db.query(
      `UPDATE ${tableName} SET ${counterField} = GREATEST(0, ${counterField} + :change) WHERE ${idColumn} = :entityId`,
      {
        change,
        entityId,
      },
    )
  }

  // These methods are kept for backward compatibility and clarity, but just delegate to the generic method
  private async updatePostCounter({
    postId,
    markerType,
    change,
  }: {
    postId: number
    markerType: MarkerType
    change: number
  }): Promise<void> {
    await this.updateEntityCounter({
      entityType: 'post',
      entityId: postId,
      markerType,
      change,
    })
  }

  private async updateCommentCounter({
    commentId,
    markerType,
    change,
  }: {
    commentId: number
    markerType: MarkerType
    change: number
  }): Promise<void> {
    await this.updateEntityCounter({
      entityType: 'comment',
      entityId: commentId,
      markerType,
      change,
    })
  }

  private async updateUserCounter({
    userId,
    markerType,
    change,
  }: {
    userId: number
    markerType: MarkerType
    change: number
  }): Promise<void> {
    await this.updateEntityCounter({
      entityType: 'user',
      entityId: userId,
      markerType,
      change,
    })
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
    // This method needs a proper update to accept targetType as a parameter
    // For now, we'll attempt to infer from markerType but fall back to trying all fields
    let field = ''

    if (markerType.startsWith('post')) {
      field = 'post_id'
    } else if (markerType.startsWith('comment')) {
      field = 'comment_id'
    } else if (markerType.startsWith('user')) {
      field = 'user_id'
    } else {
      // With simple marker types, we need to try all possible ID fields
      // This is inefficient but works as a stopgap solution
      const fields = ['post_id', 'comment_id', 'user_id']

      for (const tryField of fields) {
        const query = `
          SELECT * FROM markers 
          WHERE ${tryField} = :targetId 
          AND creator_id = :creatorId 
          AND marker_type = :markerType
          AND removed_at IS NULL
        `
        const rows = await this.db.fetchAll<MarkerRaw>(query, { targetId, creatorId, markerType })

        if (rows.length) {
          return rows[0]
        }
      }

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

  /**
   * Helper method to construct marker type filter for SQL queries
   */
  private buildMarkerTypesFilter(
    markerTypes?: string[],
    params: any = {},
  ): { filterClause: string; updatedParams: any } {
    if (!markerTypes || markerTypes.length === 0) {
      return { filterClause: '', updatedParams: params }
    }

    // Create parameter placeholders for the IN clause
    const placeholders = markerTypes.map((_, i) => `:markerType${i}`).join(', ')

    // Add marker types to params
    const updatedParams = { ...params }
    markerTypes.forEach((type, i) => {
      updatedParams[`markerType${i}`] = type
    })

    return {
      filterClause: `AND marker_type IN (${placeholders})`,
      updatedParams,
    }
  }

  /**
   * Note: buildTextFilter method has been removed and its functionality
   * is now integrated directly into getMarkedEntityIds for better SQL construction
   */

  /**
   * Generic method to get marked entity IDs with pagination and filtering
   * Uses a more efficient query structure with DISTINCT and JOIN
   */
  private async getMarkedEntityIds<T extends { [key: string]: number }>(options: {
    entityType: 'post' | 'comment' | 'user'
    creatorId: number
    markerTypes?: string[]
    filter?: string
    limit?: number
    offset?: number
  }): Promise<{ ids: number[]; total: number }> {
    const { entityType, creatorId, markerTypes, filter, limit = 20, offset = 0 } = options

    // Determine the target field and entity alias
    const entityField = `${entityType}_id`
    const entityAlias = entityType.charAt(0)
    const entityTable = entityType === 'post' ? 'posts' : entityType === 'comment' ? 'comments' : 'users'

    // Initialize params
    let params: any = {
      creatorId,
      limit,
      offset,
    }

    // Build the base query using the optimized approach with DISTINCT and JOIN
    let query = `
      SELECT ${entityAlias}.${entityField}
      FROM (
        SELECT DISTINCT ${entityField}
        FROM markers
        WHERE creator_id = :creatorId
        AND removed_at IS NULL
    `

    let countQuery = `
      SELECT COUNT(DISTINCT ${entityField}) as total
      FROM markers
      WHERE creator_id = :creatorId
      AND removed_at IS NULL
    `

    // Add marker types filter to both queries
    const markerTypesResult = this.buildMarkerTypesFilter(markerTypes, params)
    if (markerTypesResult.filterClause) {
      query += ` ${markerTypesResult.filterClause}`
      countQuery += ` ${markerTypesResult.filterClause}`
      params = markerTypesResult.updatedParams
    }

    // Close the subquery and add the JOIN with entity table
    query += `
      ) AS m
      JOIN ${entityTable} ${entityAlias} ON ${entityAlias}.${entityField} = m.${entityField}
    `

    // Add WHERE clause when filtering by text
    if (filter && filter.trim() !== '') {
      // Add filter parameter
      const updatedParams = { ...params, filter: `%${filter}%` }
      params = updatedParams

      // Define search fields based on entity type
      let entitySearchFields: string[]
      switch (entityType) {
        case 'post':
          entitySearchFields = [`${entityAlias}.title LIKE :filter`, `${entityAlias}.source LIKE :filter`]
          break
        case 'comment':
          entitySearchFields = [`${entityAlias}.source LIKE :filter`]
          break
        case 'user':
          entitySearchFields = [`${entityAlias}.username LIKE :filter`, `${entityAlias}.name LIKE :filter`]
          break
      }

      // Set the WHERE clause checking either entity fields or marker annotation
      query += `
        WHERE (${entitySearchFields.join(' OR ')})
        OR EXISTS (
          SELECT 1 FROM markers m2 
          WHERE m2.${entityField} = ${entityAlias}.${entityField}
            AND m2.creator_id = :creatorId 
            AND m2.removed_at IS NULL
            AND m2.annotation LIKE :filter
        )
      `
    }

    // Order by the appropriate column based on entity type
    // Posts and comments have created_at, but users have registered
    const orderByField = entityType === 'user' ? 'registered_at' : 'created_at'

    query += `
      ORDER BY ${entityAlias}.${orderByField} DESC
      LIMIT :limit OFFSET :offset
    `

    // Execute the queries
    const results = await this.db.fetchAll<T>(query, params)

    // For count query, we need a copy of params without the pagination parameters
    const countParams = { ...params }
    delete countParams.limit
    delete countParams.offset

    const [countResult] = await this.db.fetchAll<{ total: number }>(countQuery, countParams)

    // Get the ID field name from the entity type
    const idField = `${entityType}_id` as keyof T

    // Return the IDs and total count
    return {
      ids: results.map((r) => r[idField] as number),
      total: countResult ? countResult.total : 0,
    }
  }

  // Public methods using the generic implementation

  async getMarkedPostIds({
    creatorId,
    markerTypes,
    filter,
    limit = 20,
    offset = 0,
  }: {
    creatorId: number
    markerTypes?: string[]
    filter?: string
    limit?: number
    offset?: number
  }): Promise<{ ids: number[]; total: number }> {
    return this.getMarkedEntityIds<{ post_id: number }>({
      entityType: 'post',
      creatorId,
      markerTypes,
      filter,
      limit,
      offset,
    })
  }

  async getMarkedCommentIds({
    creatorId,
    markerTypes,
    filter,
    limit = 20,
    offset = 0,
  }: {
    creatorId: number
    markerTypes?: string[]
    filter?: string
    limit?: number
    offset?: number
  }): Promise<{ ids: number[]; total: number }> {
    return this.getMarkedEntityIds<{ comment_id: number }>({
      entityType: 'comment',
      creatorId,
      markerTypes,
      filter,
      limit,
      offset,
    })
  }

  async getMarkedUserIds({
    creatorId,
    markerTypes,
    filter,
    limit = 20,
    offset = 0,
  }: {
    creatorId: number
    markerTypes?: string[]
    filter?: string
    limit?: number
    offset?: number
  }): Promise<{ ids: number[]; total: number }> {
    return this.getMarkedEntityIds<{ user_id: number }>({
      entityType: 'user',
      creatorId,
      markerTypes,
      filter,
      limit,
      offset,
    })
  }

  /**
   * Count distinct target IDs marked by a user
   * Efficiently uses COUNT(DISTINCT) to avoid fetching large result sets
   */
  async countDistinctTargetIds({
    creatorId,
    targetType,
    markerTypes,
  }: {
    creatorId: number
    targetType: 'post' | 'comment' | 'user'
    markerTypes?: string[]
  }): Promise<number> {
    // Determine the target field based on target type
    const targetField = `${targetType}_id`

    // Start building the query
    let query = `
      SELECT COUNT(DISTINCT ${targetField}) as count
      FROM markers
      WHERE creator_id = :creatorId
      AND ${targetField} IS NOT NULL
      AND removed_at IS NULL
    `

    // Initialize params
    let params: any = { creatorId }

    // Add marker types filter if provided
    if (markerTypes && markerTypes.length > 0) {
      const typesFilter = this.buildMarkerTypesFilter(markerTypes, params)
      query += ` ${typesFilter.filterClause}`
      params = typesFilter.updatedParams
    }

    // Execute the query
    const [result] = await this.db.fetchAll<{ count: number }>(query, params)

    return result ? result.count : 0
  }
}
