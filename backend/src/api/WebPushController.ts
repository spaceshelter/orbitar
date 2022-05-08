import {Router} from 'express';
import {Logger} from 'winston';
import {APIRequest, APIResponse} from './ApiMiddleware';
import UserManager from '../managers/UserManager';
import {WebPushSubscribeRequest, WebPushSubscribeResponse} from './types/requests/WebPushSubscribe';

export default class WebPushController {
    router = Router();
    private logger: Logger;
    private userManager: UserManager;

    constructor(userManager: UserManager, logger: Logger) {
        this.logger = logger;
        this.userManager = userManager;

        this.router.post('/webpush/subscribe', (req, res) => this.subscribe(req, res));
    }

    async subscribe(request: APIRequest<WebPushSubscribeRequest>, response: APIResponse<WebPushSubscribeResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        if (!request.body.subscription) {
            return response.error('no-subscription', 'Subscription required', 400);
        }

        await this.userManager.setCredentials(request.session.data.userId, 'web-push', request.body.subscription);

        response.status(200).success({});
    }
}
