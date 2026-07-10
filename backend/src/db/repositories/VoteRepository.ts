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

export type VoteWithUsername = {
  vote: number
  username: string
  userId: number
  voterId: number
}

export type UserRatingOnSubsite = {
  site_id: number
  site_name: string
  subdomain: string
  comment_rating: number
  post_rating: number
}

export default class VoteRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async getUserVote(userId: number, byUserId: number): Promise<number> {
    const voteResult = await this.db.fetchOne<{ vote: number }>(
      'select vote from user_karma where user_id=:user_id and voter_id=:voter_id',
      {
        user_id: userId,
        voter_id: byUserId,
      },
    )

    return voteResult?.vote || 0
  }

  private async setVotes(entityId: number, vote: number, userId: number, comments: boolean): Promise<number> {
    const entityField = comments ? 'comment_id' : 'post_id'
    const entityVotesTable = comments ? 'comment_votes' : 'post_votes'
    const entityTable = comments ? 'comments' : 'posts'
    const userSiteRatingField = comments ? 'comment_rating' : 'post_rating'

    return await this.db.inTransaction(async (conn) => {
      // Important! transaction must start with locking the most "coarse" table first (entity table)
      // to prevent deadlocks
      // tricky: related tables (entity_votes), are implicitly locking records in the entity table
      const entity = await conn.fetchOne<{
        site_id: string
        author_id: string
        rating: string
      }>(
        `select site_id, author_id, rating
                 from ${entityTable}
                 where ${entityField} = :entity_id
                     FOR UPDATE /* locks the row */`,
        {
          entity_id: entityId,
        },
      )
      const entitySite = Number(entity.site_id)
      const authorId = Number(entity.author_id)
      const prevRating = Number(entity.rating || 0)

      // The target author is read under the entity lock above. Updating it on a
      // duplicate repairs any stale denormalized value without changing voted_at.
      await conn.query(
        `insert into ${entityVotesTable} ( ${entityField}, voter_id, vote, target_user_id )
             values ( :entity_id, :voter_id, 0, :target_user_id )
             on duplicate key update target_user_id = :target_user_id`,
        {
          entity_id: entityId,
          voter_id: userId,
          target_user_id: authorId,
        },
      )

      await conn.query(
        `insert ignore into user_site_rating (user_id, site_id, ${userSiteRatingField} ) values ( :user_id, :site_id, 0 )`,
        {
          user_id: authorId,
          site_id: entitySite,
        },
      )

      await conn.query(`insert ignore into user_user_rating (user_id, voter_id ) values ( :user_id, :voter_id )`, {
        user_id: authorId,
        voter_id: userId,
      })

      const prevVote = await conn
        .fetchOne<{ vote: string }>(
          `select vote
                 from ${entityVotesTable}
                 where ${entityField} = :entity_id
                   and voter_id = :voter_id
                     FOR UPDATE` /* Locks the row, or waits for the lock */,
          {
            entity_id: entityId,
            voter_id: userId,
          },
        )
        .then((res) => Number(res.vote || 0))

      if (prevVote === vote) {
        return prevRating
      }

      await conn.query(
        `update ${entityVotesTable}
                 set vote=:vote,
                     voted_at=now()
                 where ${entityField} = :entity_id
                   and voter_id = :voter_id
                   and vote = :prev_vote`,
        {
          entity_id: entityId,
          voter_id: userId,
          vote: vote,
          prev_vote: prevVote,
        },
      )

      await conn.query(
        `update ${entityTable}
                 set rating=rating + :delta
                 where ${entityField} = :entity_id`,
        {
          entity_id: entityId,
          delta: vote - prevVote,
        },
      )

      // lock the row to prevent concurrent updates
      await conn.query(
        `select ${userSiteRatingField}
                 from user_site_rating
                 where user_id = :user_id
                   and site_id = :site_id
                     FOR UPDATE` /*locks the row*/,
        {
          user_id: authorId,
          site_id: entitySite,
        },
      )

      await conn.query(
        `update user_site_rating
                    set ${userSiteRatingField}=${userSiteRatingField} + :delta
                    where user_id = :user_id
                        and site_id = :site_id`,
        {
          user_id: authorId,
          site_id: entitySite,
          delta: vote - prevVote,
        },
      )

      // lock the row to prevent concurrent updates
      await conn.query(
        `select ${userSiteRatingField}
                 from user_user_rating
                 where user_id = :user_id
                   and voter_id = :voter_id
                     FOR UPDATE` /*locks the row*/,
        {
          user_id: authorId,
          voter_id: userId,
        },
      )

      await conn.query(
        `update user_user_rating
                    set ${userSiteRatingField}=${userSiteRatingField} + :delta
                    where user_id = :user_id
                      and voter_id = :voter_id`,
        {
          user_id: authorId,
          voter_id: userId,
          delta: vote - prevVote,
        },
      )

      return prevRating + vote - prevVote
    })
  }

  async postSetVote(postId: number, vote: number, userId: number): Promise<number> {
    return this.setVotes(postId, vote, userId, false)
  }

  async commentSetVote(commentId: number, vote: number, userId: number): Promise<number> {
    return this.setVotes(commentId, vote, userId, true)
  }

  async userSetVote(toUserId: number, vote: number, voterId: number): Promise<number> {
    return await this.db.inTransaction(async (conn) => {
      await conn.query(
        `insert into user_karma (user_id, voter_id, vote)
             values (:user_id, :voter_id, :vote)
             on duplicate key update
               voted_at = if(vote <> :vote, now(), voted_at),
               vote = :vote`,
        {
          user_id: toUserId,
          voter_id: voterId,
          vote: vote,
        },
      )

      const ratingResult = await conn.fetchOne<{ rating: number }>(
        'select sum(vote) rating from user_karma where user_id=:user_id',
        {
          user_id: toUserId,
        },
      )
      const rating = Number(ratingResult.rating || 0)

      await conn.query('update users set karma=:karma where user_id=:user_id', {
        karma: rating,
        user_id: toUserId,
      })

      return rating
    })
  }

  private buildVoteFeedCursorCondition(spec: VoteFeedBranchSpec, cursor?: VoteFeedCursor): string {
    if (!cursor) {
      return ''
    }

    // The feed is ordered by (votedAt, type, entityId, voterId), all descending.
    // The branch type is a constant, so its place in the tuple comparison is resolved
    // here instead of in SQL ('user' > 'post' > 'comment' both in JS and in MySQL).
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

  // straight_join + force index keep the branch driven by the votes table: without them
  // the MySQL 5.7 optimizer may drive the join from posts/comments and filesort the
  // user's whole vote history instead of walking the feed index backwards and stopping
  // at the limit. The branch order by matches the outer sort restricted to one branch:
  // InnoDB secondary indexes implicitly end with the PK columns, so (user, voted_at)
  // indexes yield (voted_at, entityId, voterId) order with no filesort (that is also
  // why those indexes must not include `vote`).
  private buildVoteFeedBranch(
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

    return `
      (select straight_join ${spec.selects}
        from ${spec.table} ${spec.alias} force index (${spec.forceIndex[direction]})
              ${spec.joins}
              ${filterJoins}
       where ${spec.whereColumn[direction]} = :user_id
         and ${spec.alias}.vote != 0
         ${spec.extraConditions}
         ${filterCondition}
         ${this.buildVoteFeedCursorCondition(spec, cursor)}
       order by ${spec.alias}.voted_at desc, ${spec.entityIdColumn} desc, ${spec.alias}.voter_id desc
       limit :branch_limit)`
  }

  async getVoteFeedEvents(
    userId: number,
    direction: VoteFeedDirection,
    filter: string,
    cursor: VoteFeedCursor | undefined,
    limit: number,
  ): Promise<VoteFeedReference[]> {
    const union = VOTE_FEED_BRANCHES.map((spec) => this.buildVoteFeedBranch(spec, direction, filter, cursor)).join(
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

    const result = await this.db.fetchAll<{
      type: VoteFeedEntityType
      entityId: number
      postId?: number
      voterId: number
      targetUserId: number
      vote: number
      votedAt: Date | string
    }>(query, params)

    return result.map((item) => ({
      type: item.type,
      entityId: Number(item.entityId),
      postId: item.postId == null ? undefined : Number(item.postId),
      voterId: Number(item.voterId),
      targetUserId: Number(item.targetUserId),
      vote: Number(item.vote),
      votedAt: new Date(item.votedAt),
    }))
  }

  async getPostVotes(postId: number): Promise<VoteWithUsername[]> {
    return await this.db.fetchAll(
      `select u.username, v.vote, u.user_id as userId, v.voter_id as voterId
                                       from post_votes v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.post_id = :post_id
                                       order by voted_at desc`,
      {
        post_id: postId,
      },
    )
  }

  async getCommentVotes(commentId: number): Promise<VoteWithUsername[]> {
    return await this.db.fetchAll(
      `select u.username, v.vote, u.user_id as userId, v.voter_id as voterId
                                       from comment_votes v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.comment_id = :comment_id
                                       order by voted_at desc`,
      {
        comment_id: commentId,
      },
    )
  }

  /**
   * Returns votes FOR a user (votes made by other users)
   * @param userId for whom to get votes
   */
  async getUserVotes(userId: number): Promise<VoteWithUsername[]> {
    return await this.db.fetchAll(
      `select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from user_karma v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.user_id = :user_id and v.vote != 0
                                       order by voted_at desc`,
      {
        user_id: userId,
      },
    )
  }

  async getSecondaryVotes(primaryVoters: number[]): Promise<VoteWithUsername[]> {
    if (primaryVoters.length === 0) {
      return []
    }
    return await this.db.fetchAll(
      `select u.username, v.vote as vote, v.user_id as userId, v.voter_id as voterId
             from user_karma v join users u on (v.voter_id = u.user_id)
             where v.user_id in (:primary_voters) and (v.vote != 0)
             `,
      {
        primary_voters: primaryVoters,
      },
    )
  }

  /**
   * Returns votes BY a user (votes FOR other users).
   * @param userId whose votes to get
   */
  async getVotesByUser(userId: number): Promise<VoteWithUsername[]> {
    return await this.db.fetchAll(
      `select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from user_karma v
                                                join users u on (v.user_id = u.user_id)
                                       where v.voter_id = :user_id
                                       order by voted_at desc`,
      {
        user_id: userId,
      },
    )
  }

  async getUserRatingOnSubsites(userId: number): Promise<UserRatingOnSubsite[]> {
    return await this.db.fetchAll(
      `select usr.site_id as site_id, comment_rating, post_rating, s.name as site_name, subdomain
             from user_site_rating usr
                      left join sites s on (usr.site_id = s.site_id)
             where user_id = :user_id`,
      {
        user_id: userId,
      },
    )
  }

  getNormalizedContentVotesFromUsers(userId: number): Promise<{ rating: number; voters: number }> {
    return this.db
      .fetchOne<{ rating: number; voters: number }>(
        `select sum(rating) as rating, count(*) as voters
             from (SELECT (4 / (1 + EXP(LEAST(50, -0.1 * sum(comment_rating + post_rating))))) - 2 AS rating
                   FROM user_user_rating
                   WHERE user_user_rating.user_id = :user_id
                     and exists(select 1 from user_karma where user_karma.voter_id = user_user_rating.voter_id and vote != 0)
                   group by voter_id
                  ) t`,
        {
          user_id: userId,
        },
      )
      .then((r) => ({ rating: r.rating || 0, voters: r.voters || 0 }))
  }

  getTrialsApprovers(userId: number): Promise<VoteWithUsername[]> {
    return this.db.fetchAll(
      `select u.username, v.vote, v.user_id as userId, v.voter_id as voterId
                                       from user_trial_approvers v
                                                join users u on (v.voter_id = u.user_id)
                                       where v.user_id = :user_id`,
      {
        user_id: userId,
      },
    )
  }
}
