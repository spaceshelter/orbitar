import APIBase from './APIBase';
import {FeedSorting} from '../Types/FeedSortingSettings';

export type FeedSortingSaveRequest = {
    'site-id': number;
    'feed-sorting': FeedSorting;
};

export default class FeedAPI {
    api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    saveSorting(siteId: number, feedSorting: FeedSorting): Promise<unknown> {
        return this.api.request<FeedSortingSaveRequest, unknown>('/feed/sorting', {
            'site-id': siteId,
            'feed-sorting': feedSorting
        });
    }
}
