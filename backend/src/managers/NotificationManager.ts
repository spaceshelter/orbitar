import {UserNotification, UserNotificationMention} from './types/UserNotification';
import NotificationsRepository from '../db/repositories/NotificationsRepository';
import UserKVRRepository from '../db/repositories/UserKVRRepository';
import UserRepository from '../db/repositories/UserRepository';

export default class NotificationManager {
    private notificationsRepository: NotificationsRepository;
    private userKVRepository: UserKVRRepository;
    private userRepository: UserRepository;

    constructor(notificationsRepository: NotificationsRepository, userRepository: UserRepository, userKVRepository: UserKVRRepository) {
        this.notificationsRepository = notificationsRepository;
        this.userKVRepository = userKVRepository;
        this.userRepository = userRepository;
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

    async tryMention(mention: string, byUserId: number, postId: number, commentId?: number) {
        let username;
        if (mention.substring(0, 1) === '@') {
            username = mention.substring(1);
        }
        else if (mention.substring(0, 3) === '/u/') {
            username = mention.substring(3);
        }

        if (!username) {
            return false;
        }

        const user = await this.userRepository.getUserByUsername(username);
        if (!user) {
            return false;
        }

        if (user.user_id === byUserId) {
            return false;
        }

        const notification: UserNotificationMention = {
            type: 'mention',
            mention: {
                byUserId,
                postId,
                commentId
            }
        };

        await this.sendNotification(user.user_id, notification);

        return true;
    }

    async setLastReadNotification(forUserId: number, notificationId: number) {
        await this.userKVRepository.setValue(forUserId, 'last-read-notification', ''+notificationId);
    }
}
