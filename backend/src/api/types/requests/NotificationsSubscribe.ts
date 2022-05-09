import {PushSubscription} from 'web-push';

export type NotificationsSubscribeRequest = {
    subscription: PushSubscription;
};

export type NotificationsSubscribeResponse = Record<string, unknown>;
