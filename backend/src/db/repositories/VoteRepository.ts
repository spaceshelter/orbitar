import DB from '../DB'

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

      const existingVote = await conn.fetchOne<{ vote: string; target_user_id: string | null }>(
        `select vote, target_user_id
                 from ${entityVotesTable}
                 where ${entityField} = :entity_id
                   and voter_id = :voter_id
                     FOR UPDATE` /* Locks the row, or waits for the lock */,
        {
          entity_id: entityId,
          voter_id: userId,
        },
      )
      const prevVote = Number(existingVote?.vote || 0)
      const targetChanged =
        existingVote && (existingVote.target_user_id == null || Number(existingVote.target_user_id) !== authorId)

      if (!existingVote) {
        await conn.query(
          `insert into ${entityVotesTable} ( ${entityField}, voter_id, vote, target_user_id )
               values ( :entity_id, :voter_id, :vote, :target_user_id )`,
          {
            entity_id: entityId,
            voter_id: userId,
            vote,
            target_user_id: authorId,
          },
        )
      } else if (prevVote !== vote) {
        await conn.query(
          `update ${entityVotesTable}
                   set vote = :vote,
                       target_user_id = :target_user_id,
                       voted_at = now()
                   where ${entityField} = :entity_id
                     and voter_id = :voter_id`,
          {
            entity_id: entityId,
            voter_id: userId,
            vote,
            target_user_id: authorId,
          },
        )
      } else if (targetChanged) {
        await conn.query(
          `update ${entityVotesTable}
                   set target_user_id = :target_user_id
                   where ${entityField} = :entity_id
                     and voter_id = :voter_id`,
          {
            entity_id: entityId,
            voter_id: userId,
            target_user_id: authorId,
          },
        )
      } else {
        return prevRating
      }

      const delta = vote - prevVote
      if (delta === 0) {
        return prevRating
      }

      await conn.query(
        `update ${entityTable}
                 set rating=rating + :delta
                 where ${entityField} = :entity_id`,
        {
          entity_id: entityId,
          delta,
        },
      )

      await conn.query(
        `insert into user_site_rating (user_id, site_id, ${userSiteRatingField})
             values (:user_id, :site_id, :delta)
             on duplicate key update ${userSiteRatingField} = ${userSiteRatingField} + :delta`,
        {
          user_id: authorId,
          site_id: entitySite,
          delta,
        },
      )

      await conn.query(
        `insert into user_user_rating (user_id, voter_id, ${userSiteRatingField})
             values (:user_id, :voter_id, :delta)
             on duplicate key update ${userSiteRatingField} = ${userSiteRatingField} + :delta`,
        {
          user_id: authorId,
          voter_id: userId,
          delta,
        },
      )

      return prevRating + delta
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
      // Lock both FK parents in a global order. Locking only the target deadlocks
      // reciprocal new votes when each insert checks the other user as its voter.
      const userIds = [...new Set([toUserId, voterId])].sort((a, b) => a - b)
      const lockedUsers = await conn.fetchAll<{ user_id: string; karma: string }>(
        `select user_id, karma
           from users
          where user_id in (:user_ids)
          order by user_id
          for update`,
        {
          user_ids: userIds,
        },
      )
      if (lockedUsers.length !== userIds.length) {
        throw new Error('Could not lock users for karma vote')
      }

      const targetUser = lockedUsers.find((user) => Number(user.user_id) === toUserId)
      const prevRating = Number(targetUser?.karma || 0)
      const existingVote = await conn.fetchOne<{ vote: string }>(
        `select vote
           from user_karma
          where user_id = :user_id
            and voter_id = :voter_id
          for update`,
        {
          user_id: toUserId,
          voter_id: voterId,
        },
      )
      const prevVote = Number(existingVote?.vote || 0)

      if (existingVote && prevVote === vote) {
        return prevRating
      }

      if (existingVote) {
        await conn.query(
          `update user_karma
              set vote = :vote,
                  voted_at = now()
            where user_id = :user_id
              and voter_id = :voter_id`,
          {
            user_id: toUserId,
            voter_id: voterId,
            vote,
          },
        )
      } else {
        await conn.query(
          `insert into user_karma (user_id, voter_id, vote)
               values (:user_id, :voter_id, :vote)`,
          {
            user_id: toUserId,
            voter_id: voterId,
            vote,
          },
        )
      }

      const delta = vote - prevVote
      if (delta !== 0) {
        await conn.query('update users set karma = karma + :delta where user_id = :user_id', {
          delta,
          user_id: toUserId,
        })
      }

      return prevRating + delta
    })
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
