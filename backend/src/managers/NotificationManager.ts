import webpush from 'web-push'
import { Logger } from 'winston'

import { SiteConfig, VapidConfig } from '../config'
import CommentRepository from '../db/repositories/CommentRepository'
import NotificationsRepository from '../db/repositories/NotificationsRepository'
import PostRepository from '../db/repositories/PostRepository'
import SiteRepository from '../db/repositories/SiteRepository'
import WebPushRepository from '../db/repositories/WebPushRepository'
import { NotificationRaw } from '../db/types/NotificationRaw'
import { CommentRaw, PostRaw } from '../db/types/PostRaw'
import SiteManager from './SiteManager'
import { CommentBaseInfo } from './types/CommentInfo'
import {
  UserNotification,
  UserNotificationAnswer,
  UserNotificationExpanded,
  UserNotificationMention,
} from './types/UserNotification'
import { UserCache } from './UserCache'

export default class NotificationManager {
  private readonly commentRepository: CommentRepository
  private readonly notificationsRepository: NotificationsRepository
  private readonly postRepository: PostRepository
  private readonly siteRepository: SiteRepository
  private readonly webPushRepository: WebPushRepository
  private readonly userCache: UserCache
  private couldSendWebPush = false
  private siteConfig: SiteConfig
  private logger: Logger
  private siteManagerLazy: () => SiteManager

  constructor(
    commentRepository: CommentRepository,
    notificationsRepository: NotificationsRepository,
    postRepository: PostRepository,
    userCache: UserCache,
    siteRepository: SiteRepository,
    siteManagerLazy: () => SiteManager /*FIXME: HAX*/,
    webPushRepository: WebPushRepository,
    vapidConfig: VapidConfig,
    siteConfig: SiteConfig,
    logger: Logger,
  ) {
    this.siteManagerLazy = siteManagerLazy
    this.commentRepository = commentRepository
    this.notificationsRepository = notificationsRepository
    this.postRepository = postRepository
    this.siteRepository = siteRepository
    this.userCache = userCache

    this.webPushRepository = webPushRepository
    this.siteConfig = siteConfig
    this.logger = logger

    if (vapidConfig.publicKey && vapidConfig.privateKey && vapidConfig.contact) {
      webpush.setVapidDetails(vapidConfig.contact, vapidConfig.publicKey, vapidConfig.privateKey)
      this.couldSendWebPush = true
      this.logger.info('Web push notifications enabled')
    } else {
      this.logger.warn('Web push notifications disabled - missing VAPID configuration', {
        hasPublicKey: !!vapidConfig.publicKey,
        hasPrivateKey: !!vapidConfig.privateKey,
        hasContact: !!vapidConfig.contact,
      })
    }
  }

  get siteManager() {
    return this.siteManagerLazy()
  }

  async getNotificationsCounts(forUserId: number): Promise<{ unread: number; visible: number }> {
    const unread = this.notificationsRepository.getUnreadNotificationsCount(forUserId)
    const visible = this.notificationsRepository.getVisibleNotificationsCount(forUserId)
    return { unread: await unread, visible: await visible }
  }

  async getNotifications(forUserId: number): Promise<UserNotificationExpanded[]> {
    const rawNotifications = await this.notificationsRepository.getNotifications(forUserId)
    return this.expandNotifications(rawNotifications)
  }

  async expandNotification(
    notification: NotificationRaw,
    cachedData: UserNotification | undefined = undefined,
    cachedPost: PostRaw | undefined = undefined,
    cachedComment: CommentRaw | undefined = undefined,
  ): Promise<UserNotificationExpanded | undefined> {
    try {
      const data = cachedData ? cachedData : (JSON.parse(notification.data) as UserNotification)
      data.type = notification.type

      switch (data.type) {
        case 'answer':
        case 'mention': {
          const byUserRaw = await this.userCache.getById(data.source.byUserId)
          if (!byUserRaw) {
            return
          }
          const byUser = {
            id: byUserRaw.id,
            username: byUserRaw.username,
            gender: byUserRaw.gender,
          }

          const postRaw =
            cachedPost && cachedPost.post_id === data.source.postId
              ? cachedPost
              : await this.postRepository.getPost(data.source.postId)
          if (!postRaw) {
            return
          }
          const site = await this.siteManager.getSiteById(postRaw.site_id)

          const post = {
            id: postRaw.post_id,
            site: site.site,
            title: postRaw.title,
          }

          let comment: CommentBaseInfo
          if (data.source.commentId) {
            const commentRaw =
              cachedComment && cachedComment.comment_id === data.source.commentId
                ? cachedComment
                : await this.commentRepository.getComment(data.source.commentId)
            comment = {
              id: commentRaw.comment_id,
              content: commentRaw.encrypted_payload_id ? '🔒 Шифровка' : commentRaw.source,
            }
          }

          return {
            id: notification.notification_id,
            type: data.type,
            date: notification.created_at,
            read: notification.read === 1,
            source: {
              byUser,
              post,
              comment,
            },
          }
        }
        default: {
          return
        }
      }
    } catch {
      return
    }
  }

  async expandNotifications(notification: NotificationRaw[]): Promise<UserNotificationExpanded[] | undefined> {
    const postIds = new Set<number>()
    const commentIds = new Set<number>()
    const parsedData = new Map<number, UserNotification>()
    for (const n of notification) {
      const data = JSON.parse(n.data) as UserNotification
      if (data.source.postId) {
        postIds.add(data.source.postId)
      }
      if (data.source.commentId) {
        commentIds.add(data.source.commentId)
      }
      parsedData.set(n.notification_id, data)
    }

    const postsRaw = new Map(
      (await this.postRepository.getPostsByIds(Array.from(postIds))).map((p) => [p.post_id, p] as const),
    )
    const commentsRaw = new Map(
      (await this.commentRepository.getComments(Array.from(commentIds))).map((c) => [c.comment_id, c] as const),
    )

    const notifications: UserNotificationExpanded[] = []
    for (const n of notification) {
      const data = parsedData.get(n.notification_id)
      const postRaw = postsRaw.get(data.source.postId)
      const commentRaw = data.source.commentId ? commentsRaw.get(data.source.commentId) : undefined
      const notification = await this.expandNotification(n, data, postRaw, commentRaw)
      if (notification) {
        notifications.push(notification)
      }
    }

    return notifications
  }

  async sendNotification(forUserId: number, notification: UserNotification) {
    const json = JSON.stringify(notification)
    await this.notificationsRepository.addNotification(
      forUserId,
      notification.type,
      notification.source.byUserId,
      notification.source.postId,
      notification.source.commentId,
      json,
    )
    this.userCache.deleteUserStatsCache(forUserId)

    // send push in background
    this.sendWebPush(forUserId, notification)
      .then()
      .catch((err) => this.logger.error('Failed to send web push', { forUserId, err }))
  }

  async sendAnswerNotify(forUserId: number, byUserId: number, postId: number, commentId?: number) {
    if (forUserId === byUserId) {
      return false
    }

    const notification: UserNotificationAnswer = {
      type: 'answer',
      date: new Date(),
      source: {
        byUserId,
        postId,
        commentId,
      },
    }

    await this.sendNotification(forUserId, notification)
  }

  async sendMentionNotify(mention: string, byUserId: number, postId: number, commentId?: number) {
    let username
    if (mention.substring(0, 1) === '@') {
      username = mention.substring(1)
    } else {
      username = mention
    }

    if (!username) {
      return false
    }

    const user = await this.userCache.getByUsername(username)
    if (!user) {
      return false
    }

    if (user.id === byUserId) {
      return false
    }

    const notification: UserNotificationMention = {
      type: 'mention',
      date: new Date(),
      source: {
        byUserId,
        postId,
        commentId,
      },
    }

    await this.sendNotification(user.id, notification)

    return true
  }

  async setRead(forUserId: number, notificationId: number) {
    await this.notificationsRepository.setRead(forUserId, notificationId)
    this.userCache.deleteUserStatsCache(forUserId)
  }

  async setReadAndHidden(userId: number, hideId: number) {
    await this.notificationsRepository.setReadAndHidden(userId, hideId)
    this.userCache.deleteUserStatsCache(userId)
  }

  async setReadForPost(forUserId: number, postId: number) {
    const res = await this.notificationsRepository.setReadForPost(forUserId, postId)
    this.userCache.deleteUserStatsCache(forUserId)
    return res
  }

  async setReadAll(forUserId: number) {
    await this.notificationsRepository.setReadAll(forUserId)
    this.userCache.deleteUserStatsCache(forUserId)
  }

  async setHiddenAll(forUserId: number, readOnly: boolean) {
    await this.notificationsRepository.setReadAndHideAll(forUserId, readOnly)
    this.userCache.deleteUserStatsCache(forUserId)
  }

  private async sendWebPush(forUserId: number, notification: UserNotification) {
    if (!this.couldSendWebPush) {
      this.logger.debug('Skipping web push - VAPID not configured')
      return
    }

    if (!notification.source.byUserId || !notification.source.commentId) {
      return
    }

    const subscriptions = await this.webPushRepository.getSubscriptions(forUserId)
    if (!subscriptions.length) {
      return
    }

    const sender = await this.userCache.getById(notification.source.byUserId)
    const comment = await this.commentRepository.getComment(notification.source.commentId)
    const site = await this.siteRepository.getSiteById(comment.site_id)

    if (!sender || !comment || !site) {
      return
    }

    const baseUrl = (this.siteConfig.http ? 'http://' : 'https://') + this.siteConfig.domain

    let commentText = comment.encrypted_payload_id ? '🔒 Шифровка' : comment.source
    if (commentText.length > 30) {
      commentText = commentText.substring(0, 30) + '...'
    }

    const subdomain = site.subdomain === 'main' ? '' : '/s/' + site.subdomain
    const url = `${baseUrl}${subdomain}/p${notification.source.postId}?new#${notification.source.commentId}`
    const icon = `${baseUrl}/favicon.ico`

    let title = ''
    switch (notification.type) {
      case 'answer': {
        title = `${sender.username} вам ответил`
        break
      }
      case 'mention': {
        title = `${sender.username} ваc упомянул`
        break
      }
      default: {
        return
      }
    }

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body: commentText, icon, url }))
      } catch (err) {
        const badCodes = [404, 410]
        if (badCodes.includes(err.statusCode)) {
          this.logger.info(`Bad subscription for user ${forUserId} with auth ${subscription.keys.auth},
                    got ${err.statusCode} status code, removing subscription`)
          await this.webPushRepository.resetSubscription(forUserId, subscription.keys.auth)
        } else if (err.statusCode < 500) {
          this.logger.error(err)
        }
      }
    }
  }
}
