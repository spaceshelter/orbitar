import {CommentEntity} from '../entities/CommentEntity';
import {UserEntity} from '../entities/UserEntity';
import {ContentFormat} from '../entities/ContentFormat';

export type PostCommentRequest = {
    comment_id?: number;
    post_id: number;
    content: string;
    format?: ContentFormat;
};

export type PostCommentResponse = {
    comment: CommentEntity;
    users: Record<number, UserEntity>;
};
