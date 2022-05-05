import {UserBaseEntity} from './UserEntity';
import {PostBaseEntity} from './PostEntity';
import {CommentBaseEntity} from './CommentEntity';

export type NotificationEntity = {
    type: 'answer' | 'mention';
    source: {
        byUser: UserBaseEntity;
        post: PostBaseEntity;
        comment?: CommentBaseEntity;
    };
};
