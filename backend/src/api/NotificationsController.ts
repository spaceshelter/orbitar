import NotificationManager from '../managers/NotificationManager';
import {Router} from 'express';
import {Logger} from 'winston';
import {APIRequest, APIResponse} from './ApiMiddleware';
import {NotificationsListRequest, NotificationsListResponse} from './types/requests/NotificationsList';
import {NotificationsReadRequest, NotificationsReadResponse} from './types/requests/NotificationsRead';
import {NotificationsReadAllRequest, NotificationsReadAllResponse} from './types/requests/NotificationsReadAll';

export default class NotificationsController {
    router = Router();
    private readonly notificationManager: NotificationManager;
    private logger: Logger;

    constructor(notificationManager: NotificationManager, logger) {
        this.notificationManager = notificationManager;

        this.logger = logger;
        this.router.post('/notifications/list', (req, res) => this.list(req, res));
        this.router.post('/notifications/read', (req, res) => this.read(req, res));
        this.router.post('/notifications/read/all', (req, res) => this.readAll(req, res));
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
}
