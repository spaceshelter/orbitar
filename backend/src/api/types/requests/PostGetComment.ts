import {CommentEntity} from '../entities/CommentEntity';
import {ContentFormat} from '../entities/common';
import {UserEntity} from '../entities/UserEntity';

export type PostGetCommentRequest = {
    id: number;
    format?: ContentFormat;
};

export type PostGetCommentResponse = {
    comment: CommentEntity;
    users: Record<number, UserEntity>;
};
