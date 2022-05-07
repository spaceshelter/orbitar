import DB from '../DB';
import {NotificationRaw} from '../types/NotificationRaw';
import {ResultSetHeader} from 'mysql2';

export default class NotificationsRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getUnreadNotificationsCount(forUserId: number): Promise<number> {
        const result = await this.db.fetchOne<{cnt: string}>('select count(*) cnt from notifications where user_id=:user_id and `read`=0', {
            user_id: forUserId
        });

        if (result) {
            return parseInt(result.cnt);
        }

        return 0;
    }

    async getNotifications(forUserId: number, limit = 20): Promise<NotificationRaw[]> {
        return await this.db.fetchAll<NotificationRaw>('select * from notifications where user_id=:user_id and `read`=0 order by notification_id desc limit :limit', {
            user_id: forUserId,
            limit
        });
    }

    async addNotification(forUserId: number, type: string, byUserId?: number, postId?: number, commentId?: number, data?: string): Promise<number> {
        return await this.db.insert('notifications', {
            user_id: forUserId,
            type,
            by_user_id: byUserId,
            post_id: postId,
            comment_id: commentId,
            data
        });
    }

    async setRead(forUserId: number, notificationId: number) {
        await this.db.query('update notifications set `read`=1 where user_id=:user_id and notification_id=:notification_id', {
            user_id: forUserId,
            notification_id: notificationId
        });
    }

    async setReadForPost(forUserId: number, postId: number): Promise<boolean> {
        const result = await this.db.query<ResultSetHeader>('update notifications set `read`=1 where user_id=:user_id and post_id=:post_id', {
            user_id: forUserId,
            post_id: postId
        });

        return (result.changedRows > 0);
    }

    async setReadAll(forUserId: number) {
        await this.db.query('update notifications set `read`=1 where user_id=:user_id', {
            user_id: forUserId
        });
    }
}
