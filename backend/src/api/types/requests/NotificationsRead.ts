export type NotificationsReadRequest = {
    id: number;
};

export type NotificationsHideRequest = NotificationsReadRequest;

export type NotificationsReadResponse = Record<string, never>;

export type NotificationsHideResponse = Record<string, never>;
