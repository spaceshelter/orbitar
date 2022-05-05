import {PostEntity} from '../entities/PostEntity';
import {ContentFormat} from '../entities/ContentFormat';

export type PostCreateRequest = {
    site: string;
    title: string;
    content: string;
    format?: ContentFormat;
};

export type PostCreateResponse = {
    post: PostEntity;
};
