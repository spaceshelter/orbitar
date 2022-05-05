export type NotificationRaw = {
    notification_id: number;
    user_id: number;
    type: 'answer' | 'mention';
    data: string;
    created_at: Date;
};
