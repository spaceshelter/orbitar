import APIBase from './APIBase';
import {UserGender} from '../Types/UserInfo';

export type UserBaseEntity = {
    id: number;
    username: string;
    gender: UserGender;
    karma: number;
};
export type PostBaseEntity = {
    id: number;
    site: string;
    title?: string;
};
export type CommentBaseEntity = {
    id: number;
    author: number;
    content: string;
};

export type NotificationEntity = {
    type: 'answer' | 'mention';
    date: string;
    source: {
        byUser: UserBaseEntity;
        post: PostBaseEntity;
        comment?: CommentBaseEntity;
    };
};
export type NotificationsListRequest = {
    auth?: string;
};
export type NotificationsListResponse = {
    webPushRegistered: boolean;
    notifications: NotificationEntity[];
};

export type NotificationsReadRequest = {
    id: number;
};
export type NotificationsReadResponse = Record<string, never>;
export type NotificationsHideRequest =  NotificationsReadRequest;
export type NotificationsHideResponse = Record<string, never>;
export type NotificationsReadAllRequest = Record<string, never>;
export type NotificationsReadAllResponse = Record<string, never>;
export type NotificationsHideAllRequest = {
    readOnly: boolean;
};
export type NotificationsHideAllResponse = Record<string, never>;

export type WebPushSubscribeRequest = {
    subscription: PushSubscriptionJSON;
};
export type WebPushSubscribeResponse = Record<string, unknown>;

export default class NotificationsAPI {
    api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    read(id: number): Promise<NotificationsReadResponse> {
        return this.api.request<NotificationsReadRequest, NotificationsReadResponse>('/notifications/read', {
            id: id
        });
    }
    hide(id: number): Promise<NotificationsHideResponse> {
        return this.api.request<NotificationsHideRequest, NotificationsHideResponse>('/notifications/hide', {
            id: id
        });
    }

    readAll(): Promise<NotificationsReadAllResponse> {
        return this.api.request<NotificationsReadAllRequest, NotificationsReadAllResponse>('/notifications/read/all', {
        });
    }

    hideAll(readOnly: boolean): Promise<NotificationsReadAllResponse> {
        return this.api.request<NotificationsHideAllRequest, NotificationsHideAllResponse>('/notifications/hide/all', {
            readOnly
        });
    }

    list(auth?: string): Promise<NotificationsListResponse> {
        return this.api.request<NotificationsListRequest, NotificationsListResponse>('/notifications/list', {
            auth
        });
    }

    subscribe(subscription: PushSubscription): Promise<WebPushSubscribeResponse> {
        return this.api.request<WebPushSubscribeRequest, WebPushSubscribeResponse>('/notifications/subscribe', { subscription: subscription.toJSON() });
    }
}
