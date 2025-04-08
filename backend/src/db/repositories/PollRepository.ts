import { UserBaseEntity } from '../../api/types/entities/UserEntity'
import { DBConnection } from '../DB'
import { PollWithUserVoteRaw } from '../types/PollRaw'

export default class PollRepository {
  private db: DBConnection

  constructor(db: DBConnection) {
    this.db = db
  }

  async createPoll(
    authorId: number,
    question: string,
    options: string[],
    settings: object,
    expiresAt?: string,
  ): Promise<number> {
    return await this.db.insert('polls', {
      author_id: authorId,
      question,
      options: JSON.stringify(options),
      settings: JSON.stringify(settings),
      expires_at: expiresAt || null,
    })
  }

  async getPollsBatch(ids: number[], userId?: number): Promise<PollWithUserVoteRaw[]> {
    const hasUserId = userId !== undefined && userId !== null

    const query = `
    SELECT 
      p.*,
      pv.option_id AS user_voted_option_id
    FROM polls p
    LEFT JOIN poll_votes pv 
      ON pv.poll_id = p.poll_id
      ${hasUserId ? 'AND pv.voter_id = ?' : ''}
    WHERE p.poll_id IN (?)
  `

    const params = hasUserId ? [userId, ids] : [ids]

    return this.db.fetchAll<PollWithUserVoteRaw>(query, params)
  }

  async vote(pollId: number, voterId: number, optionId: number) {
    return await this.db.inTransaction(async (connection) => {
      await connection.query('INSERT INTO poll_votes (poll_id, voter_id, option_id) VALUES (?, ?, ?)', [
        pollId,
        voterId,
        optionId,
      ])

      await connection.query(`UPDATE polls SET opt${optionId} = opt${optionId} + 1 WHERE poll_id = ?`, [pollId])
    })
  }

  async removeVotes(pollId: number, voterId: number, previousVotes: number[]) {
    return await this.db.inTransaction(async (connection) => {
      await connection.query('DELETE FROM poll_votes WHERE poll_id = ? AND voter_id = ?', [pollId, voterId])

      for (const optionId of previousVotes) {
        await this.db.query(`UPDATE polls SET opt${optionId} = opt${optionId} - 1 WHERE poll_id = ?`, [pollId])
      }
    })
  }

  async getVoters(pollId: number, optionId: number): Promise<UserBaseEntity[]> {
    const voters = await this.db.fetchAll<UserBaseEntity>(
      `SELECT u.user_id as id, u.username, u.gender 
       FROM poll_votes pv 
       JOIN users u ON pv.voter_id = u.user_id 
       WHERE pv.poll_id = ? AND pv.option_id = ?`,
      [pollId, optionId],
    )
    return voters
  }
}
