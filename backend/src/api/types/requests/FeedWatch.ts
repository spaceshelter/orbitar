import {PostEntity} from '../entities/PostEntity';
import {ContentFormat} from '../entities/common';
import {UserEntity} from '../entities/UserEntity';
import {SiteBaseEntity} from '../entities/SiteEntity';

export type FeedWatchRequest = {
    filter?: 'all' | 'new';
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};

export type FeedWatchResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, UserEntity>;
    sites: Record<string, SiteBaseEntity>;
};