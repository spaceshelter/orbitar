import NotificationManager from '../managers/NotificationManager';
import {Router} from 'express';
import {Logger} from 'winston';
import {APIRequest, APIResponse} from './ApiMiddleware';
import {NotificationsListRequest, NotificationsListResponse} from './types/requests/NotificationsList';
import {NotificationsReadRequest, NotificationsReadResponse} from './types/requests/NotificationsRead';

export default class NotificationsController {
    router = Router();
    private readonly notificationManager: NotificationManager;
    private logger: Logger;

    constructor(notificationManager: NotificationManager, logger) {
        this.notificationManager = notificationManager;

        this.logger = logger;
        this.router.post('/notifications/list', (req, res) => this.list(req, res));
        this.router.post('/notifications/read', (req, res) => this.read(req, res));
    }

    async list(request: APIRequest<NotificationsListRequest>, response: APIResponse<NotificationsListResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        try {
            const notifications = await this.notificationManager.getNotifications(userId);

            response.success({ notifications });
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
        const { id: lastReadId } = request.body;

        try {
            await this.notificationManager.setLastReadNotification(userId, lastReadId);
            return response.success({});
        }
        catch (err) {
            this.logger.error('Notifications list error', { error: err, lastReadId });
            return response.error('error', 'Unknown error', 500);
        }
    }
}
