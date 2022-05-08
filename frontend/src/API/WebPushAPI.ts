import APIBase from './APIBase';

export type WebPushSubscribeRequest = {
    subscription: PushSubscription;
};
export type WebPushSubscribeResponse = Record<string, unknown>;

export default class WebPushAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    subscribe(subscription: PushSubscription): Promise<WebPushSubscribeResponse> {
        return this.api.request<WebPushSubscribeRequest, WebPushSubscribeResponse>('/webpush/subscribe', { subscription });
    }
}
