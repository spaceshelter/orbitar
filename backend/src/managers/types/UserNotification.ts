import {UserBaseInfo} from './UserInfo';
import {PostBaseInfo} from './PostInfo';
import {CommentBaseInfo} from './CommentInfo';

export type UserNotification = UserNotificationMention | UserNotificationAnswer;

type UserNotificationSource = {
    source: {
        byUserId: number;
        postId: number;
        commentId?: number;
    };
};

export type UserNotificationMention = UserNotificationSource & {
    type: 'mention';
};

export type UserNotificationAnswer = UserNotificationSource & {
    type: 'answer';
};

export type UserNotificationExpanded = UserNotificationMentionExpanded | UserNotificationAnswerExpanded;

export type UserNotificationSourceExpanded = {
    source: {
        byUser: UserBaseInfo;
        post: PostBaseInfo;
        comment?: CommentBaseInfo;
    };
};

export type UserNotificationMentionExpanded = UserNotificationSourceExpanded & {
    type: 'mention';
};

export type UserNotificationAnswerExpanded = UserNotificationSourceExpanded & {
    type: 'answer';
};
