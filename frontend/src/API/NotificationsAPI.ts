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
export type NotificationsListRequest = Record<string, never>;
export type NotificationsListResponse = {
    notifications: NotificationEntity[];
};

export type NotificationsReadRequest = {
    id: number;
};
export type NotificationsReadResponse = Record<string, never>;
export type NotificationsReadAllRequest = Record<string, never>;
export type NotificationsReadAllResponse = Record<string, never>;


export default class NotificationsAPI {
    api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async read(id: number): Promise<NotificationsReadResponse> {
        return await this.api.request<NotificationsReadRequest, NotificationsReadResponse>('/notifications/read', {
            id: id
        });
    }

    async readAll(): Promise<NotificationsReadAllResponse> {
        return await this.api.request<NotificationsReadAllRequest, NotificationsReadAllResponse>('/notifications/read/all', {
        });
    }

    async list(): Promise<NotificationsListResponse> {
        return await this.api.request<NotificationsListRequest, NotificationsListResponse>('/notifications/list', {
        });
    }
}
