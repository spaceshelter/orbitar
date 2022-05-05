import {UserNotification} from './types/UserNotification';
import NotificationsRepository from '../db/repositories/NotificationsRepository';
import UserKVRRepository from '../db/repositories/UserKVRRepository';

export default class NotificationManager {
    private notificationsRepository: NotificationsRepository;
    private userKVRepository: UserKVRRepository;

    constructor(notificationsRepository: NotificationsRepository, userKVRepository: UserKVRRepository) {
        this.notificationsRepository = notificationsRepository;
        this.userKVRepository = userKVRepository;
    }

    async getNotificationsCount(forUserId: number) {
        let sinceId = 0;
        const lastRead = await this.userKVRepository.getValue(forUserId, 'last-read-notification');
        if (lastRead) {
            sinceId = parseInt(lastRead);
        }

        return await this.notificationsRepository.getUnreadNotificationsCount(forUserId, sinceId);
    }

    async getNotifications(forUserId: number): Promise<UserNotification[]> {
        let sinceId = 0;
        const lastRead = await this.userKVRepository.getValue(forUserId, 'last-read-notification');
        if (lastRead) {
            sinceId = parseInt(lastRead);
        }

        const rawNotifications = await this.notificationsRepository.getNotifications(forUserId, sinceId);

        return rawNotifications.map(rawNot => {
            try {
                const data = JSON.parse(rawNot.data) as UserNotification;
                data.type = rawNot.type;
                return data;
            }
            catch {
                return { type: rawNot.type };
            }
        });
    }

    async sendNotification(forUserId: number, notification: UserNotification) {
        const json = JSON.stringify(notification);
        await this.notificationsRepository.addNotification(forUserId, notification.type, json);
    }

    async setLastReadNotification(forUserId: number, notificationId: number) {
        await this.userKVRepository.setValue(forUserId, 'last-read-notification', ''+notificationId);
    }
}
