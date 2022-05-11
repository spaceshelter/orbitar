import {NotificationEntity} from '../entities/NotificationEntity';

export type NotificationsListRequest = {
    webPushAuth?: string;
};

export type NotificationsListResponse = {
    webPushRegistered: boolean;
    notifications: NotificationEntity[];
};
