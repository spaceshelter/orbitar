import {PushSubscription} from 'web-push';

export type WebPushSubscribeRequest = {
    subscription: PushSubscription;
};

export type WebPushSubscribeResponse = Record<string, unknown>;
