import {PostEntity} from '../entities/PostEntity';
import {UserEntity} from '../entities/UserEntity';
import {SiteBaseEntity} from '../entities/SiteEntity';
import {ContentFormat, FeedSorting} from '../entities/common';

export type FeedSubscriptionsRequest = {
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};

export type FeedSubscriptionsResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, UserEntity>;
    sites: Record<string, SiteBaseEntity>;
    sorting: FeedSorting;
};
