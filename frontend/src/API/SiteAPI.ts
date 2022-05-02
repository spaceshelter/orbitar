import APIBase from './APIBase';

type SubscribeRequest = {
    site: string;
    main: boolean;
    bookmarks: boolean;
}
type SubscribeResponse = {
    main: boolean;
    bookmarks: boolean;
}

export default class SiteAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean): Promise<SubscribeResponse> {
        return await this.api.request<SubscribeRequest, SubscribeResponse>('/site/subscribe', {
            site,
            main,
            bookmarks
        });
    }
}
