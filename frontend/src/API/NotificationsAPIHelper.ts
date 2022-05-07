import NotificationsAPI, {CommentBaseEntity, PostBaseEntity, UserBaseEntity} from './NotificationsAPI';
import {AppStateSetters} from '../AppState/AppState';

export type NotificationInfo = {
    id: number;
    type: 'answer' | 'mention';
    date: Date;
    source: {
        byUser: UserBaseEntity;
        post: PostBaseEntity;
        comment?: CommentBaseEntity;
    };
};

export default class NotificationsAPIHelper {
    private api: NotificationsAPI;
    private setters: AppStateSetters;

    constructor(api: NotificationsAPI, setters: AppStateSetters) {
        this.api = api;
        this.setters = setters;
    }

    async read(id: number) {
        return await this.api.read(id);
    }

    async readAll() {
        this.setters.setUserStats((old) => {
            return { ...old, notifications: 0 };
        });
        return await this.api.readAll();
    }

    async list(): Promise<NotificationInfo[]> {
        const result = await this.api.list();

        return result.notifications.map(entity => {
            const notification: NotificationInfo = entity as unknown as NotificationInfo;
            notification.date = this.api.api.fixDate(new Date(entity.date));
            return notification;
        });
    }
}
