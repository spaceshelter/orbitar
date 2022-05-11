import {ContentFormat} from '../entities/ContentFormat';
import {UserEntity} from '../entities/UserEntity';
import {CommentEntity} from '../entities/CommentEntity';

export type UserCommentsRequest = {
    username: string;
    format: ContentFormat;
    page?: number;
    perpage?: number;
};

export type UserCommentsResponse = {
    comments: CommentEntity[];
    total: number;
    users: Record<number, UserEntity>;
};
