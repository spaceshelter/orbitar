import NotificationManager from '../managers/NotificationManager';
import {Router} from 'express';
import {Logger} from 'winston';
import {APIRequest, APIResponse} from './ApiMiddleware';
import {NotificationsListRequest, NotificationsListResponse} from './types/requests/NotificationsList';
import {NotificationsReadRequest, NotificationsReadResponse} from './types/requests/NotificationsRead';
import {NotificationsReadAllRequest, NotificationsReadAllResponse} from './types/requests/NotificationsReadAll';
import UserManager from '../managers/UserManager';
import {NotificationsSubscribeRequest, NotificationsSubscribeResponse} from './types/requests/NotificationsSubscribe';
import {NotificationEntity} from './types/entities/NotificationEntity';

export default class NotificationsController {
    router = Router();
    private readonly notificationManager: NotificationManager;
    private readonly userManager: UserManager;
    private readonly logger: Logger;

    constructor(notificationManager: NotificationManager, userManager: UserManager, logger) {
        this.notificationManager = notificationManager;
        this.userManager = userManager;

        this.logger = logger;
        this.router.post('/notifications/list', (req, res) => this.list(req, res));
        this.router.post('/notifications/read', (req, res) => this.read(req, res));
        this.router.post('/notifications/read/all', (req, res) => this.readAll(req, res));
        this.router.post('/notifications/subscribe', (req, res) => this.subscribe(req, res));
    }

    async list(request: APIRequest<NotificationsListRequest>, response: APIResponse<NotificationsListResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const webPushAuth = request.body.webPushAuth;

        try {
            const notificationsInfo = await this.notificationManager.getNotifications(userId);
            const haveWebPushCredentials = webPushAuth ? !!(await this.userManager.getPushSubscription(userId, webPushAuth)) : false;

            // FIXME: converter needed
            const notifications: NotificationEntity[] = notificationsInfo.map(n => {
                const not = { ...n } as unknown as NotificationEntity;
                not.date = n.date.toISOString();
                return not;
            });

            response.success({ notifications, webPushRegistered: haveWebPushCredentials });
        }
        catch (err) {
            this.logger.error('Notifications list error', { error: err });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async read(request: APIRequest<NotificationsReadRequest>, response: APIResponse<NotificationsReadResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id: readId } = request.body;

        try {
            await this.notificationManager.setRead(userId, readId);
            return response.success({});
        }
        catch (err) {
            this.logger.error('Notifications read error', { error: err, readId });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async readAll(request: APIRequest<NotificationsReadAllRequest>, response: APIResponse<NotificationsReadAllResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;

        try {
            await this.notificationManager.setReadAll(userId);
            return response.success({});
        }
        catch (err) {
            this.logger.error('Notifications read all error', { error: err });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async subscribe(request: APIRequest<NotificationsSubscribeRequest>, response: APIResponse<NotificationsSubscribeResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        if (!request.body.subscription) {
            return response.error('no-subscription', 'Subscription required', 400);
        }

        await this.userManager.setPushSubscription(request.session.data.userId, request.body.subscription);

        response.status(200).success({});
    }
}
