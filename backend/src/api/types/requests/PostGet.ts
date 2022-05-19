import {PostEntity} from '../entities/PostEntity';
import {CommentEntity} from '../entities/CommentEntity';
import {ContentFormat} from '../entities/common';
import {SiteEntity} from '../entities/SiteEntity';
import {UserEntity} from '../entities/UserEntity';

export type PostGetRequest = {
    id: number;
    format?: ContentFormat;
    noComments?: boolean;
};

export type PostGetResponse = {
    post: PostEntity;
    site: SiteEntity;
    comments: CommentEntity[];
    users: Record<number, UserEntity>;
};
