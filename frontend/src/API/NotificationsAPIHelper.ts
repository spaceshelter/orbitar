import NotificationsAPI, {CommentBaseEntity, PostBaseEntity, UserBaseEntity} from './NotificationsAPI';
import {AppState} from '../AppState/AppState';

export type NotificationInfo = {
    id: number;
    type: 'answer' | 'mention';
    date: Date;
    read: boolean;
    source: {
        byUser: UserBaseEntity;
        post: PostBaseEntity;
        comment?: CommentBaseEntity;
    };
};

export default class NotificationsAPIHelper {
    private api: NotificationsAPI;
    private appState: AppState;

    constructor(api: NotificationsAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async read(id: number) {
        await this.api.read(id);
    }

    async hide(id: number) {
        await this.api.hide(id);
    }

    async readAll() {
        return await this.api.readAll();
    }

    async hideAll() {
        return await this.api.hideAll();
    }

    async list(auth?: string): Promise<{ webPushRegistered: boolean, notifications: NotificationInfo[] }> {
        const result = await this.api.list(auth);

        const notifications = result.notifications.map(entity => {
            const notification: NotificationInfo = entity as unknown as NotificationInfo;
            notification.date = this.api.api.fixDate(new Date(entity.date));
            return notification;
        });

        return { webPushRegistered: result.webPushRegistered, notifications };
    }

    subscribe(subscription: PushSubscription) {
        return this.api.subscribe(subscription);
    }
}
