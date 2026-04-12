import { UserBaseEntity } from '../../api/types/entities/UserEntity'
import { DBConnection } from '../DB'
import { PollRaw, PollWithUserVoteRaw } from '../types/PollRaw'

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
    expiresAt?: Date,
  ): Promise<number> {
    return await this.db.insert('polls', {
      author_id: authorId,
      question,
      options: JSON.stringify(options),
      settings: JSON.stringify(settings),
      expires_at: expiresAt || null,
    })
  }

  async getPollsByIds(ids: number[]): Promise<PollRaw[]> {
    return this.db.fetchAll<PollWithUserVoteRaw>(
      `SELECT p.*
       FROM polls p
       WHERE p.poll_id IN (:ids)`,
      { ids },
    )
  }

  async getVotesBatch(voterId: number, pollIds: number[]): Promise<{ poll_id: number; option_id: number }[]> {
    return this.db.fetchAll(
      `SELECT pv.poll_id, pv.option_id
      FROM poll_votes pv
      WHERE pv.voter_id = :voterId AND pv.poll_id IN (:pollIds)`,
      {
        voterId,
        pollIds,
      },
    )
  }

  /**
   * Updates the poll options based on the user's vote.
   * @param pollId
   * @param voterId
   * @param optionIds
   */
  async vote(pollId: number, voterId: number, optionIds: number[]) {
    // validate optionIds
    if (optionIds.some((id) => !Number.isInteger(id) || id < 0 || id > 31)) {
      throw new Error('Invalid options')
    }

    return await this.db.inTransaction(async (connection) => {
      // select for update, needed to lock the row
      await connection.fetchOne('SELECT * FROM polls WHERE poll_id = :pollId FOR UPDATE', { pollId })

      // find existing votes
      const existingVotes = (
        await connection.fetchAll<{ option_id: number }>(
          'SELECT option_id FROM poll_votes WHERE poll_id = :pollId AND voter_id = :voterId',
          { pollId, voterId },
        )
      ).map((vote) => vote.option_id)

      const newVotes = optionIds.filter((id) => !existingVotes.includes(id))
      const toRemove = existingVotes.filter((id) => !optionIds.includes(id))

      await this.updatePollOptionsBatch(
        connection,
        pollId,
        new Map<number, number>([
          ...newVotes.map((id): [number, number] => [id, 1]),
          ...toRemove.map((id): [number, number] => [id, -1]), // Decrement for removed votes
        ]),
      )

      if (toRemove.length > 0) {
        // Remove votes for options that are no longer selected
        await connection.query(
          'DELETE FROM poll_votes WHERE poll_id = :pollId AND voter_id = :voterId AND option_id IN (:toRemove)',
          { pollId, voterId, toRemove },
        )
      }
      await this.insertVotesBatch(newVotes, pollId, voterId, connection)
    })
  }

  private async insertVotesBatch(newVotes: number[], pollId: number, voterId: number, connection: DBConnection) {
    if (newVotes.length > 0) {
      // parameterized query for batch inserts
      const placeholders = newVotes.map(() => '(?, ?, ?)').join(', ')
      const params = []

      // Flatten the parameters for each row
      newVotes.forEach((optionId) => {
        params.push(pollId, voterId, optionId)
      })

      await connection.query(`INSERT INTO poll_votes (poll_id, voter_id, option_id) VALUES ${placeholders}`, params)
    }
  }

  /**
   * Updates multiple poll options in a single query
   * @param connection - Database connection to use
   * @param pollId - The poll ID
   * @param optionChanges - Map of option IDs to their delta values (can be positive or negative)
   */
  private async updatePollOptionsBatch(
    connection: DBConnection,
    pollId: number,
    optionChanges: Map<number, number>,
  ): Promise<void> {
    if (optionChanges.size === 0) return

    const setClauses: string[] = []
    const params: number[] = []

    // Build SET statements for all options in one query
    for (const [optionId, delta] of optionChanges) {
      setClauses.push(`opt${optionId} = opt${optionId} + ?`)
      params.push(delta)
    }

    params.push(pollId)
    await connection.query(`UPDATE polls SET ${setClauses.join(', ')} WHERE poll_id = ?`, params)
  }

  /**
   * Returns the latest completed poll for each unique question matching 'Премия Орбитара #%'.
   * Used to compute Orbitar Award winners.
   */
  async getOrbitarAwardPolls(awardAuthorId: number): Promise<PollRaw[]> {
    return this.db.fetchAll<PollRaw>(
      `SELECT p.*
       FROM polls p
       INNER JOIN (
         SELECT question, MAX(created_at) AS latest_created_at
         FROM polls
         WHERE author_id = :awardAuthorId
           AND question LIKE 'Премия Орбитара #%'
           AND expires_at IS NOT NULL
           AND expires_at < NOW()
         GROUP BY question
       ) AS latest ON p.question = latest.question AND p.created_at = latest.latest_created_at`,
      { awardAuthorId },
    )
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
