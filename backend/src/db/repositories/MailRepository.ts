import DB from '../DB'
import { MailBatchRaw } from '../types/MailRaw'

export default class MailRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async createMail(fromUserId: number, toUserId: number, v: number, toPayload: string, fromPayload?: string) {
    return await this.db.insert('mails', {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      v,
      to_payload: toPayload,
      from_payload: fromPayload,
    })
  }

  async getMailsByIds(ids: number[]): Promise<MailBatchRaw[]> {
    if (!ids.length) {
      return []
    }

    return await this.db.fetchAll<MailBatchRaw>(
      `SELECT
         m.*,
         fu.username AS from_username,
         tu.username AS to_username
       FROM mails m
       JOIN users fu ON fu.user_id = m.from_user_id
       JOIN users tu ON tu.user_id = m.to_user_id
       WHERE m.mail_id IN (:ids)
         AND (m.post_id IS NOT NULL OR m.comment_id IS NOT NULL)`,
      { ids },
    )
  }

  async syncPostBindings(mailIds: number[], fromUserId: number, postId: number) {
    await this.db.inTransaction(async (connection) => {
      await connection.query(
        `UPDATE mails
         SET post_id = NULL, comment_id = NULL
         WHERE from_user_id = :fromUserId
           AND post_id = :postId
           AND comment_id IS NULL`,
        { fromUserId, postId },
      )

      if (!mailIds.length) {
        return
      }

      const claimable = await connection.fetchAll<{ mail_id: number }>(
        `SELECT mail_id
         FROM mails
         WHERE mail_id IN (:mailIds)
           AND from_user_id = :fromUserId
           AND (
             (post_id IS NULL AND comment_id IS NULL)
             OR (post_id = :postId AND comment_id IS NULL)
           )
         FOR UPDATE`,
        { mailIds, fromUserId, postId },
      )

      if (claimable.length !== mailIds.length) {
        throw new Error('Could not bind post mails')
      }

      await connection.query(
        `UPDATE mails
         SET post_id = :postId, comment_id = NULL
         WHERE mail_id IN (:mailIds)
           AND from_user_id = :fromUserId`,
        { mailIds, fromUserId, postId },
      )
    })
  }

  async syncCommentBindings(mailIds: number[], fromUserId: number, postId: number, commentId: number) {
    await this.db.inTransaction(async (connection) => {
      await connection.query(
        `UPDATE mails
         SET post_id = NULL, comment_id = NULL
         WHERE from_user_id = :fromUserId
           AND comment_id = :commentId`,
        { fromUserId, commentId },
      )

      if (!mailIds.length) {
        return
      }

      const claimable = await connection.fetchAll<{ mail_id: number }>(
        `SELECT mail_id
         FROM mails
         WHERE mail_id IN (:mailIds)
           AND from_user_id = :fromUserId
           AND (
             (post_id IS NULL AND comment_id IS NULL)
             OR (post_id = :postId AND comment_id = :commentId)
           )
         FOR UPDATE`,
        { mailIds, fromUserId, postId, commentId },
      )

      if (claimable.length !== mailIds.length) {
        throw new Error('Could not bind comment mails')
      }

      await connection.query(
        `UPDATE mails
         SET post_id = :postId, comment_id = :commentId
         WHERE mail_id IN (:mailIds)
           AND from_user_id = :fromUserId`,
        { mailIds, fromUserId, postId, commentId },
      )
    })
  }
}
