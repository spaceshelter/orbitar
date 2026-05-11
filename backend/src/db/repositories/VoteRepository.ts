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

    const [entitySite, authorId] = await this.db
      .fetchOne<{
        site_id: string
        author_id: string
      }>(
        `select site_id, author_id
                from ${entityTable}
                where ${entityField} = :entity_id`,
        {
          entity_id: entityId,
        },
      )
      .then((res) => [parseInt(res.site_id), parseInt(res.author_id)])

    await this.db.query(
      `insert ignore into ${entityVotesTable} ( ${entityField}, voter_id, vote ) values ( :entity_id, :voter_id, 0 )`,
      {
        entity_id: entityId,
        voter_id: userId,
      },
    )

    await this.db.query(
      `insert ignore into user_site_rating (user_id, site_id, ${userSiteRatingField} ) values ( :user_id, :site_id, 0 )`,
      {
        user_id: authorId,
        site_id: entitySite,
      },
    )

    await this.db.query(`insert ignore into user_user_rating (user_id, voter_id ) values ( :user_id, :voter_id )`, {
      user_id: authorId,
      voter_id: userId,
    })

    return await this.db.inTransaction(async (conn) => {
      // Important! transaction must start with locking the most "coarse" table first (entity table)
      // to prevent deadlocks
      // tricky: related tables (entity_votes), are implicitly locking records in the entity table
      const prevRating = await conn
        .fetchOne<{ rating: string }>(
          `select rating
                 from ${entityTable}
                 where ${entityField} = :entity_id
                     FOR UPDATE /* locks the row */`,
          {
            entity_id: entityId,
          },
        )
        .then((res) => Number(res.rating || 0))

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
               voted_at = if(vote <> values(vote), now(), voted_at),
               vote = values(vote)`,
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

  private getVoteFeedParams(userId: number, filter: string, branchLimit?: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      user_id: userId,
    }

    if (filter) {
      params.filter = `%${escapePercent(filter)}%`
    }

    if (branchLimit) {
      params.branch_limit = branchLimit
    }

    return params
  }

  private limitVoteFeedBranch(branch: string, branchLimit?: number): string {
    if (!branchLimit) {
      return branch
    }

    return `
      (select *
         from (${branch}) voteBranch
        order by votedAt desc
        limit :branch_limit)
    `
  }

  private getOutgoingVoteFeedUnion(filter: string, branchLimit?: number): string {
    const postTargetJoin = filter ? 'join users target on (target.user_id = p.author_id)' : ''
    const commentTargetJoin = filter ? 'join users target on (target.user_id = c.author_id)' : ''
    const userTargetJoin = filter ? 'join users target on (target.user_id = uk.user_id)' : ''
    const postFilter = filter
      ? 'and (p.source like :filter or p.title like :filter or target.username like :filter or target.name like :filter)'
      : ''
    const commentFilter = filter
      ? 'and (c.source like :filter or target.username like :filter or target.name like :filter)'
      : ''
    const userFilter = filter ? 'and (target.username like :filter or target.name like :filter)' : ''

    const postBranch = `
      select 'post' type,
             pv.post_id entityId,
             pv.post_id postId,
             pv.voter_id voterId,
             p.author_id targetUserId,
             pv.vote,
             pv.voted_at votedAt
        from post_votes pv
               join posts p on (p.post_id = pv.post_id)
               ${postTargetJoin}
       where pv.voter_id = :user_id
         and pv.vote != 0
         ${postFilter}
    `
    const commentBranch = `
      select 'comment' type,
             cv.comment_id entityId,
             c.post_id postId,
             cv.voter_id voterId,
             c.author_id targetUserId,
             cv.vote,
             cv.voted_at votedAt
        from comment_votes cv
               join comments c on (c.comment_id = cv.comment_id)
               ${commentTargetJoin}
       where cv.voter_id = :user_id
         and cv.vote != 0
         ${commentFilter}
    `
    const userBranch = `
      select 'user' type,
             uk.user_id entityId,
             null postId,
             uk.voter_id voterId,
             uk.user_id targetUserId,
             uk.vote,
             uk.voted_at votedAt
        from user_karma uk
               ${userTargetJoin}
       where uk.voter_id = :user_id
         and uk.vote != 0
         ${userFilter}
    `

    return [
      this.limitVoteFeedBranch(postBranch, branchLimit),
      this.limitVoteFeedBranch(commentBranch, branchLimit),
      this.limitVoteFeedBranch(userBranch, branchLimit),
    ].join('\nunion all\n')
  }

  private getReceivedVoteFeedUnion(filter: string, branchLimit?: number): string {
    const postVoterJoin = filter ? 'join users voter on (voter.user_id = pv.voter_id)' : ''
    const commentVoterJoin = filter ? 'join users voter on (voter.user_id = cv.voter_id)' : ''
    const userVoterJoin = filter ? 'join users voter on (voter.user_id = uk.voter_id)' : ''
    const postFilter = filter
      ? 'and (p.source like :filter or p.title like :filter or voter.username like :filter or voter.name like :filter)'
      : ''
    const commentFilter = filter
      ? 'and (c.source like :filter or voter.username like :filter or voter.name like :filter)'
      : ''
    const userFilter = filter ? 'and (voter.username like :filter or voter.name like :filter)' : ''

    const postBranch = `
      select 'post' type,
             pv.post_id entityId,
             pv.post_id postId,
             pv.voter_id voterId,
             p.author_id targetUserId,
             pv.vote,
             pv.voted_at votedAt
       from post_votes pv
               join posts p on (p.post_id = pv.post_id)
               ${postVoterJoin}
       where p.author_id = :user_id
         and pv.vote != 0
         ${postFilter}
    `
    const commentBranch = `
      select 'comment' type,
             cv.comment_id entityId,
             c.post_id postId,
             cv.voter_id voterId,
             c.author_id targetUserId,
             cv.vote,
             cv.voted_at votedAt
       from comment_votes cv
               join comments c on (c.comment_id = cv.comment_id)
               ${commentVoterJoin}
       where c.author_id = :user_id
         and cv.vote != 0
         ${commentFilter}
    `
    const userBranch = `
      select 'user' type,
             uk.user_id entityId,
             null postId,
             uk.voter_id voterId,
             uk.user_id targetUserId,
             uk.vote,
             uk.voted_at votedAt
       from user_karma uk
               ${userVoterJoin}
       where uk.user_id = :user_id
         and uk.vote != 0
         ${userFilter}
    `

    return [
      this.limitVoteFeedBranch(postBranch, branchLimit),
      this.limitVoteFeedBranch(commentBranch, branchLimit),
      this.limitVoteFeedBranch(userBranch, branchLimit),
    ].join('\nunion all\n')
  }

  private getVoteFeedUnion(direction: VoteFeedDirection, filter: string, branchLimit?: number): string {
    return direction === 'mine'
      ? this.getOutgoingVoteFeedUnion(filter, branchLimit)
      : this.getReceivedVoteFeedUnion(filter, branchLimit)
  }

  private getOutgoingVoteFeedTotalQuery(filter: string): string {
    const postTargetJoin = filter
      ? 'join posts p on (p.post_id = pv.post_id) join users target on (target.user_id = p.author_id)'
      : ''
    const commentTargetJoin = filter
      ? 'join comments c on (c.comment_id = cv.comment_id) join users target on (target.user_id = c.author_id)'
      : ''
    const userTargetJoin = filter ? 'join users target on (target.user_id = uk.user_id)' : ''
    const postFilter = filter
      ? 'and (p.source like :filter or p.title like :filter or target.username like :filter or target.name like :filter)'
      : ''
    const commentFilter = filter
      ? 'and (c.source like :filter or target.username like :filter or target.name like :filter)'
      : ''
    const userFilter = filter ? 'and (target.username like :filter or target.name like :filter)' : ''

    return `
      select (
        select count(*)
          from post_votes pv
               ${postTargetJoin}
         where pv.voter_id = :user_id
           and pv.vote != 0
           ${postFilter}
      ) + (
        select count(*)
          from comment_votes cv
               ${commentTargetJoin}
         where cv.voter_id = :user_id
           and cv.vote != 0
           ${commentFilter}
      ) + (
        select count(*)
          from user_karma uk
               ${userTargetJoin}
         where uk.voter_id = :user_id
           and uk.vote != 0
           ${userFilter}
      ) count
    `
  }

  private getReceivedVoteFeedTotalQuery(filter: string): string {
    const postVoterJoin = filter ? 'join users voter on (voter.user_id = pv.voter_id)' : ''
    const commentVoterJoin = filter ? 'join users voter on (voter.user_id = cv.voter_id)' : ''
    const userVoterJoin = filter ? 'join users voter on (voter.user_id = uk.voter_id)' : ''
    const postFilter = filter
      ? 'and (p.source like :filter or p.title like :filter or voter.username like :filter or voter.name like :filter)'
      : ''
    const commentFilter = filter
      ? 'and (c.source like :filter or voter.username like :filter or voter.name like :filter)'
      : ''
    const userFilter = filter ? 'and (voter.username like :filter or voter.name like :filter)' : ''

    return `
      select (
        select count(*)
          from post_votes pv
               join posts p on (p.post_id = pv.post_id)
               ${postVoterJoin}
         where p.author_id = :user_id
           and pv.vote != 0
           ${postFilter}
      ) + (
        select count(*)
          from comment_votes cv
               join comments c on (c.comment_id = cv.comment_id)
               ${commentVoterJoin}
         where c.author_id = :user_id
           and cv.vote != 0
           ${commentFilter}
      ) + (
        select count(*)
          from user_karma uk
               ${userVoterJoin}
         where uk.user_id = :user_id
           and uk.vote != 0
           ${userFilter}
      ) count
    `
  }

  private getVoteFeedTotalQuery(direction: VoteFeedDirection, filter: string): string {
    return direction === 'mine'
      ? this.getOutgoingVoteFeedTotalQuery(filter)
      : this.getReceivedVoteFeedTotalQuery(filter)
  }

  async getVoteFeedEvents(
    userId: number,
    direction: VoteFeedDirection,
    filter = '',
    page = 1,
    perpage = 20,
  ): Promise<VoteFeedReference[]> {
    const limitFrom = (page - 1) * perpage
    const branchLimit = limitFrom + perpage
    const query = `
      select type, entityId, postId, voterId, targetUserId, vote, votedAt
        from (${this.getVoteFeedUnion(direction, filter, branchLimit)}) votes
       order by votedAt desc
       limit :limit_from, :limit_count
    `
    const result = await this.db.fetchAll<{
      type: VoteFeedEntityType
      entityId: number
      postId?: number
      voterId: number
      targetUserId: number
      vote: number
      votedAt: Date | string
    }>(query, {
      ...this.getVoteFeedParams(userId, filter, branchLimit),
      limit_from: limitFrom,
      limit_count: perpage,
    })

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

  async getVoteFeedTotal(userId: number, direction: VoteFeedDirection, filter = ''): Promise<number> {
    const result = await this.db.fetchOne<{ count: number }>(
      this.getVoteFeedTotalQuery(direction, filter),
      this.getVoteFeedParams(userId, filter),
    )

    return Number(result?.count || 0)
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
