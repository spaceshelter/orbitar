import {UserRaw} from '../db/types/UserRaw';
import {UserInfo, UserGender, UserProfile, UserStats, UserRatingBySubsite} from './types/UserInfo';
import UserRepository from '../db/repositories/UserRepository';
import VoteRepository, {UserRatingOnSubsite} from '../db/repositories/VoteRepository';
import bcrypt from 'bcryptjs';
import NotificationManager from './NotificationManager';
import UserCredentials from '../db/repositories/UserCredentials';
import WebPushRepository from '../db/repositories/WebPushRepository';
import {PushSubscription} from 'web-push';
import {RedisClientType} from 'redis';

export default class UserManager {
    private credentialsRepository: UserCredentials;
    private userRepository: UserRepository;
    private voteRepository: VoteRepository;
    private notificationManager: NotificationManager;
    private webPushRepository: WebPushRepository;
    private readonly redis: RedisClientType;

    private cacheId: Record<number, UserInfo> = {};
    private cacheUsername: Record<string, UserInfo> = {};
    private cacheLastVisit: Record<number, Date> = {};

    constructor(credentialsRepository: UserCredentials, userRepository: UserRepository, voteRepository: VoteRepository, webPushRepository: WebPushRepository, notificationManager: NotificationManager, redis: RedisClientType) {
        this.credentialsRepository = credentialsRepository;
        this.userRepository = userRepository;
        this.voteRepository = voteRepository;
        this.notificationManager = notificationManager;
        this.webPushRepository = webPushRepository;
        this.redis = redis;
    }

    async getById(userId: number): Promise<UserInfo | undefined> {
        if (this.cacheId[userId]) {
            return this.cacheId[userId];
        }

        const rawUser = await this.userRepository.getUserById(userId);

        if (!rawUser) {
            return;
        }

        const user = this.mapUserRaw(rawUser);
        this.cache(user);
        return user;
    }

    private cache(user: UserInfo) {
        this.cacheId[user.id] = user;
        this.cacheUsername[user.username] = user;
    }

    async getByUsername(username: string): Promise<UserInfo | undefined> {
        if (this.cacheUsername[username]) {
            return this.cacheUsername[username];
        }

        const rawUser = await this.userRepository.getUserByUsername(username);

        if (!rawUser) {
            return;
        }

        const user = this.mapUserRaw(rawUser);
        this.cache(user);
        return user;
    }

    async getFullProfile(username: string, forUserId: number): Promise<UserProfile | undefined> {
        const rawUser = await this.userRepository.getUserByUsername(username);
        if (!rawUser) {
            return;
        }

        const vote = await this.voteRepository.getUserVote(rawUser.user_id, forUserId);

        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name,
            registered: rawUser.registered_at,
            vote: vote
        };
    }

    async getInvitedBy(userId: number): Promise<UserInfo | undefined> {
        const invitedByRaw = await this.userRepository.getUserParent(userId);

        if (!invitedByRaw) {
            return;
        }

        return this.mapUserRaw(invitedByRaw);
    }

    async getInvites(userId: number): Promise<UserInfo[]> {
        const invitesRaw = await this.userRepository.getUserChildren(userId);

        return invitesRaw.map(raw => this.mapUserRaw(raw));
    }

    async checkPassword(username: string, password: string): Promise<UserInfo | false> {
        const userRaw = await this.userRepository.getUserByUsername(username);

        if (!await bcrypt.compare(password, userRaw.password)) {
            return false;
        }

        return this.mapUserRaw(userRaw);
    }

    async registerByInvite(inviteCde: string, username: string, name: string, email: string, passwordHash: string, gender: UserGender): Promise<UserInfo> {
        const userRaw = await this.userRepository.userRegister(inviteCde, username, name, email, passwordHash, gender);

        return this.mapUserRaw(userRaw);
    }

    async getUserStats(forUserId: number): Promise<UserStats> {
        const unreadComments = await this.userRepository.getUserUnreadComments(forUserId);
        const notifications = await this.notificationManager.getNotificationsCount(forUserId);

        return {
            notifications,
            watch: {
                comments: unreadComments,
                posts: 0
            }
        };
    }

    async setCredentials<T>(forUserId: number, type: string, value: T) {
        return await this.credentialsRepository.setCredential(forUserId, type, value);
    }

    async getCredentials<T>(forUserId: number, type: string): Promise<T | undefined> {
        return await this.credentialsRepository.getCredential<T>(forUserId, type);
    }

    async getPushSubscription(forUserId: number, auth: string) {
        return await this.webPushRepository.getSubscription(forUserId, auth);
    }

    async setPushSubscription(forUserId: number, subscription: PushSubscription) {
        if (!subscription.keys || !subscription.keys.auth) {
            throw new Error('Auth key required');
        }
        return await this.webPushRepository.setSubscription(forUserId, subscription);
    }

    async resetPushSubscription(forUserId: number, auth: string) {
        return await this.webPushRepository.resetSubscription(forUserId, auth);
    }

    logVisit(userId: number) {
        const date = this.truncateVisitDate(new Date());
        if (!this.cacheLastVisit[userId] || this.cacheLastVisit[userId].getTime() !== date.getTime()) {
            this.cacheLastVisit[userId] = date;
            return this.userRepository.logVisit(userId, date);
        }
        return Promise.resolve();
    }

    truncateVisitDate(date: Date, truncatePeriodMs: number = 12 * 60 * 60 * 1000 /*12h*/) {
        return new Date(Math.floor(date.getTime() / truncatePeriodMs) * truncatePeriodMs);
    }

    async getNumActiveUsers() {
        const numActiveUsers = await this.redis.get('num_active_users');
        if (!numActiveUsers) {
            const numActiveUsers = await this.userRepository.getNumActiveUsers();
            await this.redis.set('num_active_users', numActiveUsers);
            await this.redis.expire('num_active_users', 60 * 60 * 6 /*6 h*/);
            return numActiveUsers;
        }
        return parseInt(numActiveUsers);
    }

    async isUserActive(userId: number) {
        const isActive = await this.redis.get(`is_user_active_${userId}`);
        if (!isActive) {
            const isActive = await this.userRepository.isUserActive(userId);
            await this.redis.set(`is_user_active_${userId}`, isActive.toString());
            const random1h = Math.floor(Math.random() * 60 * 60);
            await this.redis.expire(`is_user_active_${userId}`, 60 * 60 * 6 + random1h /*6h + (0-1) h */);
            return isActive;
        }
        return isActive === 'true';
    }

    async getUserRatingBySubsite(userId: number): Promise<UserRatingBySubsite> {
        const ratingBySubsite: UserRatingOnSubsite[] =
            await this.voteRepository.getUserRatingOnSubsites(userId);
        const postRatingBySubsite: Record<string, number> = {};
        const commentRatingBySubsite: Record<string, number> = {};
        for (const rating of ratingBySubsite) {
            if (rating.post_rating) {
                postRatingBySubsite[rating.subdomain] = rating.post_rating;
            }
            if (rating.comment_rating) {
                commentRatingBySubsite[rating.subdomain] = rating.comment_rating;
            }
        }
        return {
            postRatingBySubsite,
            commentRatingBySubsite
        };
    }

    private mapUserRaw(rawUser: UserRaw): UserInfo {
        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name
        };
    }
}
