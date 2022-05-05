import {UserInfo} from './UserInfo';
import {PostBaseInfo} from './PostInfo';

export type UserNotification = UserNotificationMention | UserNotificationAnswer | {
    type: string;
};

export type UserNotificationMention = {
    type: 'mention';
    mention: {
        byUserId: number;
        postId: number;
        commentId?: number;
    };
};

export type UserNotificationAnswer = {
    type: 'answer';
    answer: {
        user: UserInfo;
        post: PostBaseInfo;
        commentId: number;
    }
};
