export type NotificationRaw = {
    notification_id: number;
    user_id: number;
    type: 'answer' | 'mention';
    read: number;
    data: string;
    created_at: Date;
};
