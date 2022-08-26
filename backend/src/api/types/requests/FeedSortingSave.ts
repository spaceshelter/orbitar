import {FeedSorting} from '../entities/common';

export type FeedSortingSaveRequest = {
    site: string;
    feedSorting: FeedSorting;
};

export type FeedSortingSaveResponse = Record<string, unknown>;
