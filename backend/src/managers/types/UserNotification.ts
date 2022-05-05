import {UserInfo} from './UserInfo';
import {PostBaseInfo} from './PostInfo';

export type UserNotification = UserNotificationMention | UserNotificationAnswer;

export type UserNotificationMention = {
    type: 'mention';
    mention: {
        user: UserInfo;
        post: PostBaseInfo;
        commentId: number;
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
