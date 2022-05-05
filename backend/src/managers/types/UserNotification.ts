export type UserNotification = UserNotificationMention | UserNotificationAnswer | {
    type: string;
};

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
