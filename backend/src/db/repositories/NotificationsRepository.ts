import { ResultSetHeader } from 'mysql2'

import DB from '../DB'
import { NotificationRaw } from '../types/NotificationRaw'

// Excludes notifications triggered by a user the recipient has muted.
// `by_user_id is null` keeps authorless/system notifications (a bare `not in` would
// drop them, since `NULL not in (...)` is NULL, not true).
const NOT_MUTED =
  '(by_user_id is null or by_user_id not in ' +
  '(select muted_user_id from user_notification_mute where user_id=:user_id))'

export default class NotificationsRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async getUnreadNotificationsCount(forUserId: number): Promise<number> {
    const result = await this.db.fetchOne<{ cnt: string }>(
      `select count(*) cnt from notifications where user_id=:user_id and \`read\`=0 and ${NOT_MUTED}`,
      {
        user_id: forUserId,
      },
    )
    return parseInt(result?.cnt || '0')
  }

  async getVisibleNotificationsCount(forUserId: number): Promise<number> {
    const result = await this.db.fetchOne<{ cnt: string }>(
      `select count(*) cnt from notifications where user_id=:user_id and hidden=0 and ${NOT_MUTED}`,
      {
        user_id: forUserId,
      },
    )
    return parseInt(result?.cnt || '0')
  }

  async getNotifications(forUserId: number, limit = 20): Promise<NotificationRaw[]> {
    return await this.db.fetchAll<NotificationRaw>(
      `select * from notifications where user_id=:user_id and hidden=0 and ${NOT_MUTED} ` +
        'order by notification_id desc limit :limit',
      {
        user_id: forUserId,
        limit,
      },
    )
  }

  async muteUser(forUserId: number, mutedUserId: number): Promise<void> {
    await this.db.query(
      'insert into user_notification_mute (user_id, muted_user_id) values (:user_id, :muted_user_id) ' +
        'on duplicate key update user_id=user_id',
      {
        user_id: forUserId,
        muted_user_id: mutedUserId,
      },
    )
  }

  async unmuteUser(forUserId: number, mutedUserId: number): Promise<void> {
    await this.db.query('delete from user_notification_mute where user_id=:user_id and muted_user_id=:muted_user_id', {
      user_id: forUserId,
      muted_user_id: mutedUserId,
    })
  }

  async getMutedUserIds(forUserId: number): Promise<number[]> {
    const rows = await this.db.fetchAll<{ muted_user_id: number }>(
      'select muted_user_id from user_notification_mute where user_id=:user_id order by created_at desc',
      {
        user_id: forUserId,
      },
    )
    return rows.map((r) => r.muted_user_id)
  }

  async isMuted(forUserId: number, mutedUserId: number): Promise<boolean> {
    const row = await this.db.fetchOne<{ one: number }>(
      'select 1 one from user_notification_mute where user_id=:user_id and muted_user_id=:muted_user_id',
      {
        user_id: forUserId,
        muted_user_id: mutedUserId,
      },
    )
    return !!row
  }

  async addNotification(
    forUserId: number,
    type: string,
    byUserId?: number,
    postId?: number,
    commentId?: number,
    data?: string,
  ): Promise<number> {
    return await this.db.insert('notifications', {
      user_id: forUserId,
      type,
      by_user_id: byUserId,
      post_id: postId,
      comment_id: commentId,
      data,
    })
  }

  async setRead(forUserId: number, notificationId: number) {
    await this.db.query(
      'update notifications set `read`=1 where user_id=:user_id and notification_id=:notification_id',
      {
        user_id: forUserId,
        notification_id: notificationId,
      },
    )
  }

  async setReadAndHidden(forUserId: number, hideId: number) {
    await this.db.query(
      'update notifications set hidden=1, `read` = 1 where user_id=:user_id and notification_id=:notification_id',
      {
        user_id: forUserId,
        notification_id: hideId,
      },
    )
  }

  async setReadForPost(forUserId: number, postId: number): Promise<boolean> {
    const result = await this.db.query<ResultSetHeader>(
      'update notifications set `read`=1 where user_id=:user_id and post_id=:post_id',
      {
        user_id: forUserId,
        post_id: postId,
      },
    )

    return result.changedRows > 0
  }

  async setReadAll(forUserId: number) {
    await this.db.query('update notifications set `read`=1 where user_id=:user_id', {
      user_id: forUserId,
    })
  }

  async setReadAndHideAll(forUserId: number, readOnly = false) {
    await this.db.query(
      `
            update notifications set hidden=1, \`read\`=1 where user_id=:user_id
                ${readOnly ? 'and `read`=1' : ''}
            `,
      {
        user_id: forUserId,
      },
    )
  }
}
