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
    subscriptions: SiteWithUserInfo[];
};

type SiteRequest = {
    site: string;
};
type SiteResponse = {
    site: SiteWithUserInfo;
};

type SiteCreateRequest = {
    site: string;
    name: string;
};
type SiteCreateResponse = {
    site: SiteWithUserInfo;
};

type SiteListRequest = {
    page: number;
    perpage: number;
};

type SiteListResponse = {
    sites: SiteWithUserInfo[];
};

type SubscriptionsRequest = {};
type SubscriptionsResponse = {
    subscriptions: SiteWithUserInfo[];
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

    async create(site: string, name: string): Promise<SiteCreateResponse> {
        return await this.api.request<SiteCreateRequest, SiteCreateResponse>('/site/create', {
            site, name
        });
    }

    async subscribe(site: string, main: boolean, bookmarks: boolean): Promise<SubscribeResponse> {
        return await this.api.request<SubscribeRequest, SubscribeResponse>('/site/subscribe', {
            site,
            main,
            bookmarks
        });
    }

    async subscriptions(): Promise<SubscriptionsResponse> {
        return await this.api.request<SubscriptionsRequest, SubscriptionsResponse>('/site/subscriptions', {});
    }

    async list(page: number, perpage: number): Promise<SiteListResponse> {
        return await this.api.request<SiteListRequest, SiteListResponse>('/site/list', {
            page, perpage
        });
    }
}
