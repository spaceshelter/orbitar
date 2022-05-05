import {PostEntity} from '../entities/PostEntity';
import {UserEntity} from '../entities/UserEntity';
import {ContentFormat} from '../entities/ContentFormat';
import {SiteBaseEntity} from '../entities/SiteEntity';

export type FeedPostsRequest = {
    site: string;
    page?: number;
    perpage?: number;
    format?: ContentFormat;
};

export type FeedPostsResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, UserEntity>;
    site: SiteBaseEntity;
};