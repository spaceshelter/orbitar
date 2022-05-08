import {ContentFormat} from '../entities/ContentFormat';
import {PostEntity} from '../entities/PostEntity';
import {UserEntity} from '../entities/UserEntity';

export type UserPostsRequest = {
    username: string;
    format: ContentFormat;
    page?: number;
    perpage?: number;
};

export type UserPostsResponse = {
    posts: PostEntity[];
    total: number;
    users: Record<number, UserEntity>;
};