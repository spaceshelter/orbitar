import {ContentFormat} from '../entities/ContentFormat';

export type UserPostsRequest = {
    username: string;
    format: ContentFormat;
    page?: number;
    perpage?: number;
};
