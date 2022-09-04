import APIBase from './APIBase';
import {FeedSorting} from '../Types/FeedSortingSettings';

export type FeedSortingSaveRequest = {
    site: string;
    feedSorting: FeedSorting;
};

export default class FeedAPI {
    api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    saveSorting(site: string, feedSorting: FeedSorting): Promise<void> {
        return this.api.request<FeedSortingSaveRequest, void>('/feed/sorting', {
            site,
            feedSorting
        });
    }
}
