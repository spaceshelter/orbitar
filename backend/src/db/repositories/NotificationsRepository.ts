import DB from '../DB';
import {NotificationRaw} from '../types/NotificationRaw';

export default class NotificationsRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getUnreadNotificationsCount(forUserId: number, sinceId: number): Promise<number> {
        const result = await this.db.fetchOne<{cnt: string}>('select count(*) cnt from notifications where user_id=:user_id and notification_id > :since_id', {
            user_id: forUserId,
            since_id: sinceId
        });

        if (result) {
            return parseInt(result.cnt);
        }

        return 0;
    }

    async getNotifications(forUserId: number, sinceId: number, limit = 20): Promise<NotificationRaw[]> {
        return await this.db.fetchAll<NotificationRaw>('select * from notifications where user_id=:user_id and notification_id > :since_id order by notification_id desc limit :limit', {
            user_id: forUserId,
            since_id: sinceId,
            limit
        });
    }

    async addNotification(forUserId: number, type: string, data: string): Promise<number> {
        return await this.db.insert('notifications', {
            user_id: forUserId,
            type,
            data
        });
    }
}
