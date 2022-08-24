import {FeedSorting} from '../../../db/types/FeedSortingSettings';

export type FeedSortingSaveRequest = {
    'site-id': number;
    'feed-sorting': FeedSorting;
};

export type FeedSortingSaveResponse = {};
