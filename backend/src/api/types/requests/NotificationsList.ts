import {NotificationEntity} from '../entities/NotificationEntity';

export type NotificationsListRequest = Record<string, never>;

export type NotificationsListResponse = {
    webPushRegistered: boolean;
    notifications: NotificationEntity[];
};
