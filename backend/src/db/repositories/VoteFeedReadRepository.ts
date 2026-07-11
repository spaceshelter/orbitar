import { escapePercent } from '../../utils/MySqlUtils'
import DB from '../DB'

export type VoteFeedDirection = 'mine' | 'received'
export type VoteFeedEntityType = 'post' | 'comment' | 'user'

export type VoteFeedReference = {
  type: VoteFeedEntityType
  entityId: number
  postId?: number
  voterId: number
  targetUserId: number
  vote: number
  votedAt: Date
}

// Keyset cursor: position of the last seen event in the
// (votedAt, type, entityId, voterId) descending order.
export type VoteFeedCursor = {
  votedAt: Date
  type: VoteFeedEntityType
  entityId: number
  voterId: number
}

export type ReceivedPostSubjectRaw = {
  id: number
  site: string
  title: string
  html: string
  rating: number
}

export type ReceivedCommentSubjectRaw = {
  id: number
  postId: number
  site: string
  postTitle: string
  rating: number
}

type VoteFeedBranchSpec = {
  type: VoteFeedEntityType
  table: string
  alias: string
  entityIdColumn: string
  selects: string
  forceIndex: Record<VoteFeedDirection, string>
  joins: string
  filterJoins: string
  filterEntityCondition: string
  whereColumn: Record<VoteFeedDirection, string>
  filterUserColumn: Record<VoteFeedDirection, string>
  extraConditions: string
}

const VOTE_FEED_BRANCHES: VoteFeedBranchSpec[] = [
  {
    type: 'post',
    table: 'post_votes',
    alias: 'pv',
    entityIdColumn: 'pv.post_id',
    selects:
      "'post' type, pv.post_id entityId, pv.post_id postId, pv.voter_id voterId," +
      ' pv.target_user_id targetUserId, pv.vote, pv.voted_at votedAt',
    forceIndex: { mine: 'idx_post_votes_voter_voted_at', received: 'idx_post_votes_target_voted_at' },
    joins: '',
    filterJoins: 'join posts p on (p.post_id = pv.post_id)',
    filterEntityCondition: 'p.source like :filter or p.title like :filter',
    whereColumn: { mine: 'pv.voter_id', received: 'pv.target_user_id' },
    filterUserColumn: { mine: 'pv.target_user_id', received: 'pv.voter_id' },
    extraConditions: '',
  },
  {
    type: 'comment',
    table: 'comment_votes',
    alias: 'cv',
    entityIdColumn: 'cv.comment_id',
    selects:
      "'comment' type, cv.comment_id entityId, c.post_id postId, cv.voter_id voterId," +
      ' cv.target_user_id targetUserId, cv.vote, cv.voted_at votedAt',
    forceIndex: { mine: 'idx_comment_votes_voter_voted_at', received: 'idx_comment_votes_target_voted_at' },
    joins: 'join comments c on (c.comment_id = cv.comment_id)',
    filterJoins: '',
    filterEntityCondition: 'c.source like :filter',
    whereColumn: { mine: 'cv.voter_id', received: 'cv.target_user_id' },
    filterUserColumn: { mine: 'cv.target_user_id', received: 'cv.voter_id' },
    extraConditions: 'and c.deleted = 0',
  },
  {
    type: 'user',
    table: 'user_karma',
    alias: 'uk',
    entityIdColumn: 'uk.user_id',
    selects:
      "'user' type, uk.user_id entityId, null postId, uk.voter_id voterId," +
      ' uk.user_id targetUserId, uk.vote, uk.voted_at votedAt',
    forceIndex: { mine: 'idx_user_karma_voter_voted_at', received: 'idx_user_karma_user_voted_at' },
    joins: '',
    filterJoins: '',
    filterEntityCondition: '',
    whereColumn: { mine: 'uk.voter_id', received: 'uk.user_id' },
    filterUserColumn: { mine: 'uk.user_id', received: 'uk.voter_id' },
    extraConditions: '',
  },
]

export default class VoteFeedReadRepository {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  private buildCursorCondition(spec: VoteFeedBranchSpec, cursor?: VoteFeedCursor): string {
    if (!cursor) {
      return ''
    }

    const votedAt = `${spec.alias}.voted_at`
    if (spec.type > cursor.type) {
      return `and ${votedAt} < :cursor_voted_at`
    }
    if (spec.type < cursor.type) {
      return `and ${votedAt} <= :cursor_voted_at`
    }
    return (
      `and (${votedAt} < :cursor_voted_at or (${votedAt} = :cursor_voted_at and ` +
      `(${spec.entityIdColumn} < :cursor_entity_id or ` +
      `(${spec.entityIdColumn} = :cursor_entity_id and ${spec.alias}.voter_id < :cursor_voter_id))))`
    )
  }

  private buildBranch(
    spec: VoteFeedBranchSpec,
    direction: VoteFeedDirection,
    filter: string,
    cursor?: VoteFeedCursor,
  ): string {
    const filterJoins = filter
      ? `${spec.filterJoins} join users fu on (fu.user_id = ${spec.filterUserColumn[direction]})`
      : ''
    const entityFilter = spec.filterEntityCondition ? `${spec.filterEntityCondition} or ` : ''
    const filterCondition = filter ? `and (${entityFilter}fu.username like :filter or fu.name like :filter)` : ''

    // Driving each branch from its feed index lets MySQL 5.7 stop at the
    // branch limit instead of scanning and sorting the user's vote history.
    return `
      (select straight_join ${spec.selects}
         from ${spec.table} ${spec.alias} force index (${spec.forceIndex[direction]})
              ${spec.joins}
              ${filterJoins}
        where ${spec.whereColumn[direction]} = :user_id
          and ${spec.alias}.vote != 0
          ${spec.extraConditions}
          ${filterCondition}
          ${this.buildCursorCondition(spec, cursor)}
        order by ${spec.alias}.voted_at desc, ${spec.entityIdColumn} desc, ${spec.alias}.voter_id desc
        limit :branch_limit)`
  }

  async getPageReferences(
    userId: number,
    direction: VoteFeedDirection,
    filter: string,
    cursor: VoteFeedCursor | undefined,
    limit: number,
  ): Promise<VoteFeedReference[]> {
    const union = VOTE_FEED_BRANCHES.map((spec) => this.buildBranch(spec, direction, filter, cursor)).join(
      '\nunion all\n',
    )
    const query = `
      select type, entityId, postId, voterId, targetUserId, vote, votedAt
        from (${union}) votes
       order by votedAt desc, type desc, entityId desc, voterId desc
       limit :limit_count
    `

    const params: Record<string, string | number | Date> = {
      user_id: userId,
      branch_limit: limit,
      limit_count: limit,
    }
    if (filter) {
      params.filter = `%${escapePercent(filter)}%`
    }
    if (cursor) {
      params.cursor_voted_at = cursor.votedAt
      params.cursor_entity_id = cursor.entityId
      params.cursor_voter_id = cursor.voterId
    }

    const rows = await this.db.fetchAll<{
      type: VoteFeedEntityType
      entityId: number
      postId?: number
      voterId: number
      targetUserId: number
      vote: number
      votedAt: Date | string
    }>(query, params)

    return rows.map((row) => ({
      type: row.type,
      entityId: Number(row.entityId),
      postId: row.postId == null ? undefined : Number(row.postId),
      voterId: Number(row.voterId),
      targetUserId: Number(row.targetUserId),
      vote: Number(row.vote),
      votedAt: new Date(row.votedAt),
    }))
  }

  async getReceivedPostSubjects(postIds: number[]): Promise<ReceivedPostSubjectRaw[]> {
    if (!postIds.length) {
      return []
    }
    return this.db.fetchAll<ReceivedPostSubjectRaw>(
      `select p.post_id id, s.subdomain site, p.title,
              if(nullif(trim(p.title), '') is null, p.html, '') html,
              p.rating
         from posts p
         join sites s on (s.site_id = p.site_id)
        where p.post_id in (:post_ids)`,
      { post_ids: postIds },
    )
  }

  async getReceivedCommentSubjects(commentIds: number[]): Promise<ReceivedCommentSubjectRaw[]> {
    if (!commentIds.length) {
      return []
    }
    return this.db.fetchAll<ReceivedCommentSubjectRaw>(
      `select c.comment_id id, c.post_id postId, s.subdomain site, p.title postTitle, c.rating
         from comments c
         join posts p on (p.post_id = c.post_id)
         join sites s on (s.site_id = c.site_id)
        where c.comment_id in (:comment_ids)
          and c.deleted = 0`,
      { comment_ids: commentIds },
    )
  }
}
