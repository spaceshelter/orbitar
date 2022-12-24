import {ContentFormat} from '../entities/common';
import {PostEntity} from '../entities/PostEntity';
import {UserEntity} from '../entities/UserEntity';

export type UserPostsRequest = {
    username: string;
    format: ContentFormat;
    filter?: string;
    page?: number;
    perpage?: number;
};

export type UserPostsResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, UserEntity>;
};