import {ContentFormat} from '../entities/ContentFormat';
import {CommentEntity} from '../entities/CommentEntity';
import {UserEntity} from '../entities/UserEntity';

export type PostCommentEditRequest = {
    id: number;
    content: string;
    format?: ContentFormat;
};

export type PostCommentEditResponse = {
    comment: CommentEntity;
    users: Record<number, UserEntity>;
};
