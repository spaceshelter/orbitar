import {
    UserNotification,
    UserNotificationAnswer,
    UserNotificationExpanded,
    UserNotificationMention
} from './types/UserNotification';
import NotificationsRepository from '../db/repositories/NotificationsRepository';
import UserKVRRepository from '../db/repositories/UserKVRRepository';
import UserRepository from '../db/repositories/UserRepository';
import CommentRepository from '../db/repositories/CommentRepository';
import {NotificationRaw} from '../db/types/NotificationRaw';
import PostRepository from '../db/repositories/PostRepository';
import SiteRepository from '../db/repositories/SiteRepository';
import {CommentBaseInfo} from './types/CommentInfo';

export default class NotificationManager {
    private commentRepository: CommentRepository;
    private notificationsRepository: NotificationsRepository;
    private postRepository: PostRepository;
    private siteRepository: SiteRepository;
    private userKVRepository: UserKVRRepository;
    private userRepository: UserRepository;

    constructor(
        commentRepository: CommentRepository, notificationsRepository: NotificationsRepository,
        postRepository: PostRepository, siteRepository: SiteRepository,
        userRepository: UserRepository, userKVRepository: UserKVRRepository
    ) {
        this.commentRepository = commentRepository;
        this.notificationsRepository = notificationsRepository;
        this.postRepository = postRepository;
        this.siteRepository = siteRepository;
        this.userKVRepository = userKVRepository;
        this.userRepository = userRepository;
    }

    async getNotificationsCount(forUserId: number) {
        let sinceId = 0;
        const lastRead = await this.userKVRepository.getValue(forUserId, 'last-read-notification');
        if (lastRead) {
            sinceId = parseInt(lastRead);
        }

        return await this.notificationsRepository.getUnreadNotificationsCount(forUserId, sinceId);
    }

    async getNotifications(forUserId: number): Promise<UserNotificationExpanded[]> {
        let sinceId = 0;
        const lastRead = await this.userKVRepository.getValue(forUserId, 'last-read-notification');
        if (lastRead) {
            sinceId = parseInt(lastRead);
        }

        const rawNotifications = await this.notificationsRepository.getNotifications(forUserId, sinceId);

        const notifications: UserNotificationExpanded[] = [];
        for (const rawNotification of rawNotifications) {
            const notification = await this.expandNotification(rawNotification);
            if (notification) {
                notifications.push(notification);
            }
        }

        return notifications;
    }

    async expandNotification(notification: NotificationRaw): Promise<UserNotificationExpanded | undefined> {
        try {
            const data = JSON.parse(notification.data) as UserNotification;
            data.type = notification.type;

            switch (data.type) {
                case 'answer':
                case 'mention': {
                    const byUserRaw = await this.userRepository.getUserById(data.source.byUserId);
                    if (!byUserRaw) {
                        return;
                    }
                    const byUser = {
                        id: byUserRaw.user_id,
                        username: byUserRaw.username
                    };

                    const postRaw = await this.postRepository.getPost(data.source.postId);
                    if (!postRaw) {
                        return;
                    }
                    const siteRaw = await this.siteRepository.getSiteById(postRaw.site_id);

                    const post = {
                        id: postRaw.post_id,
                        site: siteRaw.subdomain,
                        title: postRaw.title,
                    };

                    let comment: CommentBaseInfo;
                    if (data.source.commentId) {
                        const commentRaw = await this.commentRepository.getComment(data.source.commentId);
                        comment = {
                            id: commentRaw.comment_id,
                            content: commentRaw.source
                        };
                    }

                    return {
                        type: data.type,
                        source: {
                            byUser,
                            post,
                            comment
                        }
                    };
                }
                default: {
                    return;
                }
            }
        }
        catch {
            return;
        }
    }

    async sendNotification(forUserId: number, notification: UserNotification) {
        const json = JSON.stringify(notification);
        await this.notificationsRepository.addNotification(forUserId, notification.type, json);
    }

    async sendAnswerNotify(parentCommentId: number, byUserId: number, postId: number, commentId?: number) {
        const commentRaw = await this.commentRepository.getComment(parentCommentId);
        if (!commentRaw) {
            return false;
        }

        // if (commentRaw.author_id === byUserId) {
        //     return false;
        // }

        const notification: UserNotificationAnswer = {
            type: 'answer',
            source: {
                byUserId,
                postId,
                commentId
            }
        };

        await this.sendNotification(commentRaw.author_id, notification);
    }

    async sendMentionNotify(mention: string, byUserId: number, postId: number, commentId?: number) {
        let username;
        if (mention.substring(0, 1) === '@') {
            username = mention.substring(1);
        }
        else if (mention.substring(0, 3) === '/u/') {
            username = mention.substring(3);
        }

        if (!username) {
            return false;
        }

        const user = await this.userRepository.getUserByUsername(username);
        if (!user) {
            return false;
        }

        if (user.user_id === byUserId) {
            return false;
        }

        const notification: UserNotificationMention = {
            type: 'mention',
            source: {
                byUserId,
                postId,
                commentId
            }
        };

        await this.sendNotification(user.user_id, notification);

        return true;
    }

    async setLastReadNotification(forUserId: number, notificationId: number) {
        await this.userKVRepository.setValue(forUserId, 'last-read-notification', ''+notificationId);
    }
}
