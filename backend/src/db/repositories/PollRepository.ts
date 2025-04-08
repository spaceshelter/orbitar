import { RowDataPacket } from 'mysql2'

import { UserBaseEntity } from '../../api/types/entities/UserEntity'
import { DBConnection } from '../DB'

interface PollRecord extends RowDataPacket {
  poll_id: number
  author_id: number
  question: string
  options: string
  settings: string
  expires_at: string | null
  created_at: string
  [key: `opt${number}`]: number
}

export default class PollRepository {
  private db: DBConnection

  constructor(db: DBConnection) {
    this.db = db
  }

  async createPoll(authorId: number, question: string, options: string[], settings: object, expiresAt?: string) {
    const result = await this.db.query(
      'INSERT INTO polls (author_id, question, options, settings, expires_at) VALUES (?, ?, ?, ?, ?)',
      [authorId, question, JSON.stringify(options), JSON.stringify(settings), expiresAt || null],
    )
    return result
  }

  async getPoll(pollId: number) {
    return await this.db.fetchOne<PollRecord>('SELECT * FROM polls WHERE poll_id = ?', [pollId])
  }

  async getPollsBatch(ids: number[]) {
    return await this.db.query<PollRecord[]>(
      `SELECT * 
             FROM polls 
             WHERE poll_id IN (?)
             ORDER BY created_at DESC`,
      [ids],
    )
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

  async getUserVotes(pollId: number, voterId: number): Promise<number[]> {
    const votes = await this.db.query('SELECT option_id FROM poll_votes WHERE poll_id = ? AND voter_id = ?', [
      pollId,
      voterId,
    ])
    return (votes as RowDataPacket[]).map((v) => v.option_id)
  }

  async getOptionVoters(pollId: number, optionId: number): Promise<UserBaseEntity[]> {
    const votes = await this.db.query(
      `SELECT u.user_id as id, u.username, u.gender 
       FROM poll_votes pv 
       JOIN users u ON pv.voter_id = u.user_id 
       WHERE pv.poll_id = ? AND pv.option_id = ?`,
      [pollId, optionId],
    )
    return (votes as RowDataPacket[]).map((v) => ({
      id: v.id,
      username: v.username,
      gender: v.gender,
    }))
  }
}
