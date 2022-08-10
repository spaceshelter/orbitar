import {UserRaw} from '../db/types/UserRaw';
import {UserInfo, UserGender, UserProfile, UserStats, UserRatingBySubsite, UserRestrictions} from './types/UserInfo';
import UserRepository from '../db/repositories/UserRepository';
import VoteRepository, {UserRatingOnSubsite} from '../db/repositories/VoteRepository';
import bcrypt from 'bcryptjs';
import NotificationManager from './NotificationManager';
import UserCredentials from '../db/repositories/UserCredentials';
import WebPushRepository from '../db/repositories/WebPushRepository';
import {PushSubscription} from 'web-push';
import {RedisClientType} from 'redis';
import PostRepository from '../db/repositories/PostRepository';
import CommentRepository from '../db/repositories/CommentRepository';

export default class UserManager {
    private credentialsRepository: UserCredentials;
    private userRepository: UserRepository;
    private voteRepository: VoteRepository;
    private commentRepository: CommentRepository;
    private postRepository: PostRepository;
    private notificationManager: NotificationManager;
    private webPushRepository: WebPushRepository;
    private readonly redis: RedisClientType;

    private cacheId: Record<number, UserInfo> = {};
    private cacheUsername: Record<string, UserInfo> = {};
    private cacheLastVisit: Record<number, Date> = {};

    constructor(credentialsRepository: UserCredentials, userRepository: UserRepository, voteRepository: VoteRepository,
                commentRepository: CommentRepository,  postRepository: PostRepository,  webPushRepository: WebPushRepository, notificationManager: NotificationManager, redis: RedisClientType) {
        this.credentialsRepository = credentialsRepository;
        this.userRepository = userRepository;
        this.voteRepository = voteRepository;
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
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

    async getUserEffectiveKarma(userId: number): Promise<number> {
        const user = await this.getById(userId);
        if (!user) {
            return 0;
        }

        const userContentRating = await this.getUserRatingBySubsite(userId);
        const userVotes = await this.getActiveKarmaVotes(userId);
        const profileVotingResult = Object.values(userVotes).reduce((acc, vote) => acc + vote, 0);
        const profileVotesCount = Object.values(userVotes).length;

        const allPostsValue = Object.values(userContentRating.postRatingBySubsite).reduce((acc, rating) => acc + rating, 0);
        const allCommentsValue = Object.values(userContentRating.commentRatingBySubsite).reduce((acc, rating) => acc + rating, 0);

        const fit01 = (current: number, in_min: number, in_max: number, out_min: number, out_max: number): number => {
            const mapped: number = ((current - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
            return clamp(mapped, out_min, out_max);
        };
        const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
        const lerp = (start: number, end: number, r: number): number => (1 - r) * start + r * end;
        const bipolarSigmoid = (n: number): number => n / Math.sqrt(1 + n * n);

        const positiveCommentsDivisor = 10; // positive comments are 10x cheaper than posts
        const negativeCommentsDivisor = 2; // negative comments are only 2x cheaper than posts
        const contentVal = (allPostsValue + allCommentsValue / (allCommentsValue >= 0 ? positiveCommentsDivisor : negativeCommentsDivisor)) / 5000;
        const contentRating = (contentVal > 0 ? bipolarSigmoid(contentVal / 3) : Math.max(-1, -Math.pow(contentVal, 2) * 7));

        //user reputation ratio
        const ratio = profileVotingResult / profileVotesCount;
        const s = fit01(profileVotesCount, 10, 200, 0, 1);
        const userRating = (profileVotingResult >= 0 ? 1 : Math.max(0, 1 - lerp(Math.pow(ratio / 100, 2), Math.pow(ratio * 2, 2), s)));

        // karma without punishment
        return Math.ceil(((contentRating + 1) * userRating - 1) * 1000);
    }

    /**
     * Return non-zero profile/karma votes from active users only
     * @param userId
     */
    async getActiveKarmaVotes(userId: number): Promise<Record<string, number>> {
        const user = await this.getById(userId);
        if (!user) {
            return {};
        }

        // try fetching from redis cache first
        const cachedVotes = await this.redis.get(`active_karma_votes_${userId}`);
        if (cachedVotes) {
            return JSON.parse(cachedVotes);
        }

        const userVotes = await this.voteRepository.getUserVotes(userId);

        const activeKarmaVotes: Record<string, number> = {};
        for (const vote of userVotes) {
            if (await this.isUserActive(vote.voterId)) {
                activeKarmaVotes[vote.username] = vote.vote;
            }
        }

        // note cache is explicitly evicted when user karma changes
        await this.redis.set(`active_karma_votes_${userId}`, JSON.stringify(activeKarmaVotes));
        await this.redis.expire(`active_karma_votes_${userId}`, 60 * 30 + Math.floor(Math.random() * 60 * 5) /* 30-35 minutes */);
        return activeKarmaVotes;
    }

    async removeVotesWhenKarmaIsLow(userId: number) {
        // cached check status from redis
        const cachedStatus = await this.redis.get(`remove_votes_when_karma_is_low_${userId}`);
        if (cachedStatus) {
            return;
        }

        const karmaVotes = await this.voteRepository.getVotesByUser(userId);
        for (const vote of karmaVotes) {
            await this.voteRepository.userSetVote(vote.userId, 0, vote.voterId);
        }
        await this.redis.set(`remove_votes_when_karma_is_low_${userId}`, 'true');
        await this.redis.expire(`remove_votes_when_karma_is_low_${userId}`,
            60 * 30 + Math.floor(Math.random() * 60 * 5) /* 30-35 minutes */);
    }

    async getUserRestrictions(userId: number): Promise<UserRestrictions> {
        const effectiveKarma = await this.getUserEffectiveKarma(userId);

        if (effectiveKarma < -10) {
            await this.removeVotesWhenKarmaIsLow(userId);
        }

        const lastCommentTime = await this.commentRepository.getLastUserComment(userId).then(comment => comment?.created_at);
        const lastOwnPost = await this.postRepository.getLastUserPost(userId);

        const postSlowModeDelay = (effectiveKarma < -10 ? /*12 hours */3600 * 12 : 0);
        const commentSlowModeDelay =
            effectiveKarma <= -1000 ? /*1 hour */3600 : (effectiveKarma < -10 ? /*10 minutes */ 10 * 60 : 0);

        return {
            effectiveKarma,
            postSlowModeWaitSec: lastOwnPost ?
                Math.max(lastOwnPost.created_at.getTime() / 1000 - Date.now() / 1000 + postSlowModeDelay, 0)  : 0,
            commentSlowModeWaitSec: lastCommentTime ?
                Math.max(lastCommentTime.getTime() / 1000 - Date.now() / 1000 + commentSlowModeDelay, 0) : 0,
            restrictedToPostId: (effectiveKarma <= -1000 ? (lastOwnPost?.post_id || true) : false),
            canVote: effectiveKarma >= -10,
            canInvite : effectiveKarma > 0,
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
