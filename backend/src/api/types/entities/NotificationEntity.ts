import {UserBaseEntity} from './UserEntity';
import {PostBaseEntity} from './PostEntity';
import {CommentBaseEntity} from './CommentEntity';

export type NotificationEntity = {
    id: number;
    type: 'answer' | 'mention';
    date: string;
    source: {
        byUser: UserBaseEntity;
        post: PostBaseEntity;
        comment?: CommentBaseEntity;
    };
};
