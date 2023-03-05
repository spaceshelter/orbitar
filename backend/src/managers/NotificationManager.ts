import {
    UserNotification,
    UserNotificationAnswer,
    UserNotificationExpanded,
    UserNotificationMention
} from './types/UserNotification';
import NotificationsRepository from '../db/repositories/NotificationsRepository';
import CommentRepository from '../db/repositories/CommentRepository';
import {NotificationRaw} from '../db/types/NotificationRaw';
import PostRepository from '../db/repositories/PostRepository';
import SiteRepository from '../db/repositories/SiteRepository';
import {CommentBaseInfo} from './types/CommentInfo';
import webpush from 'web-push';
import {SiteConfig, VapidConfig} from '../config';
import WebPushRepository from '../db/repositories/WebPushRepository';
import {UserCache} from './UserCache';


export default class NotificationManager {
    private readonly commentRepository: CommentRepository;
    private readonly notificationsRepository: NotificationsRepository;
    private readonly postRepository: PostRepository;
    private readonly siteRepository: SiteRepository;
    private readonly webPushRepository: WebPushRepository;
    private readonly userCache: UserCache;
    private couldSendWebPush = false;
    private siteConfig: SiteConfig;

    constructor(
        commentRepository: CommentRepository, notificationsRepository: NotificationsRepository,
        postRepository: PostRepository, siteRepository: SiteRepository,
        userCache: UserCache, webPushRepository: WebPushRepository,
        vapidConfig: VapidConfig,
        siteConfig: SiteConfig
    ) {
        this.commentRepository = commentRepository;
        this.notificationsRepository = notificationsRepository;
        this.postRepository = postRepository;
        this.siteRepository = siteRepository;
        this.userCache = userCache;
        this.webPushRepository = webPushRepository;
        this.siteConfig = siteConfig;

        if (vapidConfig.publicKey && vapidConfig.privateKey && vapidConfig.contact) {
            webpush.setVapidDetails(vapidConfig.contact, vapidConfig.publicKey, vapidConfig.privateKey);
            this.couldSendWebPush = true;
        }
    }

    async getNotificationsCounts(forUserId: number): Promise<{ unread: number, visible: number }> {
        const unread = this.notificationsRepository.getUnreadNotificationsCount(forUserId);
        const visible = this.notificationsRepository.getVisibleNotificationsCount(forUserId);
        return {unread: await unread, visible: await visible};
    }

    async getNotifications(forUserId: number): Promise<UserNotificationExpanded[]> {
        const rawNotifications = await this.notificationsRepository.getNotifications(forUserId);

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
                    const byUserRaw = await this.userCache.getById(data.source.byUserId);
                    if (!byUserRaw) {
                        return;
                    }
                    const byUser = {
                        id: byUserRaw.id,
                        username: byUserRaw.username,
                        gender: byUserRaw.gender
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
                        id: notification.notification_id,
                        type: data.type,
                        date: notification.created_at,
                        read: notification.read === 1,
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
        await this.notificationsRepository.addNotification(forUserId, notification.type, notification.source.byUserId, notification.source.postId, notification.source.commentId, json);
        this.userCache.deleteUserStatsCache(forUserId);

        // send push in background
        this.sendWebPush(forUserId, notification).then().catch();
    }

    async sendAnswerNotify(parentCommentId: number, byUserId: number, postId: number, commentId?: number) {
        const commentRaw = await this.commentRepository.getComment(parentCommentId);
        if (!commentRaw) {
            return false;
        }

        if (commentRaw.author_id === byUserId) {
            return false;
        }

        const notification: UserNotificationAnswer = {
            type: 'answer',
            date: new Date(),
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
        } else {
            username = mention;
        }

        if (!username) {
            return false;
        }

        const user = await this.userCache.getByUsername(username);
        if (!user) {
            return false;
        }

        if (user.id === byUserId) {
            return false;
        }

        const notification: UserNotificationMention = {
            type: 'mention',
            date: new Date(),
            source: {
                byUserId,
                postId,
                commentId
            }
        };

        await this.sendNotification(user.id, notification);

        return true;
    }

    async setRead(forUserId: number, notificationId: number) {
        await this.notificationsRepository.setRead(forUserId, notificationId);
        this.userCache.deleteUserStatsCache(forUserId);
    }

    async setReadAndHidden(userId: number, hideId: number) {
        await this.notificationsRepository.setReadAndHidden(userId, hideId);
        this.userCache.deleteUserStatsCache(userId);
    }

    async setReadForPost(forUserId: number, postId: number) {
        const res = await this.notificationsRepository.setReadForPost(forUserId, postId);
        this.userCache.deleteUserStatsCache(forUserId);
        return res;
    }

    async setReadAll(forUserId: number) {
        await this.notificationsRepository.setReadAll(forUserId);
        this.userCache.deleteUserStatsCache(forUserId);
    }

    async setHiddenAll(forUserId: number) {
        await this.notificationsRepository.setReadAndHideAll(forUserId);
        this.userCache.deleteUserStatsCache(forUserId);
    }

    private async sendWebPush(forUserId: number, notification: UserNotification) {
        if (!this.couldSendWebPush) {
            return;
        }

        if (!notification.source.byUserId || !notification.source.commentId) {
            return;
        }

        const subscriptions = await this.webPushRepository.getSubscriptions(forUserId);
        if (!subscriptions.length) {
            return;
        }

        const sender = await this.userCache.getById(notification.source.byUserId);
        const comment = await this.commentRepository.getComment(notification.source.commentId);
        const site = await this.siteRepository.getSiteById(comment.site_id);

        if (!sender || !comment || !site) {
            return;
        }

        const baseUrl = (this.siteConfig.http ? 'http://' : 'https://') +  this.siteConfig.domain;

        let commentText = comment.source;
        if (commentText.length > 30) {
            commentText = commentText.substring(0, 30) + '...';
        }

        const subdomain = (site.subdomain === 'main' ? '' : '/s/' + site.subdomain);
        const url = `${baseUrl}${subdomain}/p${notification.source.postId}?new#${notification.source.commentId}`;
        const icon = `${baseUrl}/favicon.ico`;

        let title = '';
        switch (notification.type) {
            case 'answer': {
                title = `${sender.username} вам ответил`;
                break;
            }
            case 'mention': {
                title = `${sender.username} ваc упомянул`;
                break;
            }
            default: {
                return;
            }
        }

        for (const subscription of subscriptions) {
            try {
                await webpush.sendNotification(subscription, JSON.stringify({title, body: commentText, icon, url}));
            }
            catch (err) {
                if (err.statusCode === 410) {
                    await this.webPushRepository.resetSubscription(forUserId, subscription.keys.auth);
                }
            }
        }
    }
}
