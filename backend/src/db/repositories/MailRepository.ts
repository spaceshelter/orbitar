import DB from '../DB'
import { MailBatchRaw } from '../types/MailRaw'

export default class MailRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async createMail(fromUserId: number, toUserId: number | null, v: number, toPayload: string, fromPayload?: string) {
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
       LEFT JOIN users tu ON tu.user_id = m.to_user_id
       WHERE m.mail_id IN (:ids)`,
      { ids },
    )
  }
}
