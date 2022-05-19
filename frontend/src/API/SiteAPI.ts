import APIBase from './APIBase';
import {SiteWithUserInfo} from '../Types/SiteInfo';

type SubscribeRequest = {
    site: string;
    main: boolean;
    bookmarks: boolean;
};
type SubscribeResponse = {
    main: boolean;
    bookmarks: boolean;
};

type SiteRequest = {
    site: string;
};
type SiteResponse = {
    site: SiteWithUserInfo;
};

export default class SiteAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async site(site: string): Promise<SiteResponse> {
        return await this.api.request<SiteRequest, SiteResponse>('/site', {
            site
        });
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean): Promise<SubscribeResponse> {
        return await this.api.request<SubscribeRequest, SubscribeResponse>('/site/subscribe', {
            site,
            main,
            bookmarks
        });
    }
}
