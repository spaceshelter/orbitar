import {UserRaw} from '../db/types/UserRaw';
import {UserInfo, UserGender, UserStats, UserRatingBySubsite, UserRestrictions} from './types/UserInfo';
import UserRepository from '../db/repositories/UserRepository';
import VoteRepository, {UserRatingOnSubsite, VoteWithUsername} from '../db/repositories/VoteRepository';
import bcrypt from 'bcryptjs';
import NotificationManager from './NotificationManager';
import UserCredentials from '../db/repositories/UserCredentials';
import WebPushRepository from '../db/repositories/WebPushRepository';
import {PushSubscription} from 'web-push';
import {RedisClientType} from 'redis';
import PostRepository from '../db/repositories/PostRepository';
import CommentRepository from '../db/repositories/CommentRepository';
import {TrialProgressDebugInfo} from '../api/types/requests/UserProfile';
import {sendResetPasswordEmail} from '../utils/Mailer';
import {SiteConfig} from '../config';
import {Logger} from 'winston';
import {FeedSorting} from '../api/types/entities/common';

const USER_RESTRICTIONS = {
    MIN_KARMA: -1000,
    NEG_KARMA_THRESH: -10,
    POS_KARMA_THRESH: 1,
    NEW_USER_AGE_DAYS: 3
};

export default class UserManager {
    private credentialsRepository: UserCredentials;
    private userRepository: UserRepository;
    private voteRepository: VoteRepository;
    private commentRepository: CommentRepository;
    private postRepository: PostRepository;
    private notificationManager: NotificationManager;
    private webPushRepository: WebPushRepository;
    private readonly redis: RedisClientType;
    private siteConfig: SiteConfig;
    private cacheId: Record<number, UserInfo> = {};
    private cacheUsername: Record<string, UserInfo> = {};
    private cacheLastVisit: Record<number, Date> = {};
    private cachedUserParents: Record<number, number | undefined | false> = {};
    private readonly logger: Logger;
    private readonly mailLogger: Logger;

    private cachedNumActiveUsersThatCanVote = {
        expirationMs: 1000 * 60 * 60 /* 1 hour */,
        value: 0,
        lastUpdateTs: 0
    };

    private userRestrictionsCache = new Map<number, {
        ts: Date,
        effectiveKarmaWOPenalty: number,
        lastOwnPost: { post_id: number, created_at: Date } | undefined,
        lastCommentTime: Date | undefined,
    }>();

    constructor(credentialsRepository: UserCredentials, userRepository: UserRepository, voteRepository: VoteRepository,
                commentRepository: CommentRepository,  postRepository: PostRepository,  webPushRepository: WebPushRepository,
                notificationManager: NotificationManager, redis: RedisClientType, siteConfig: SiteConfig, logger: Logger) {
        this.credentialsRepository = credentialsRepository;
        this.userRepository = userRepository;
        this.voteRepository = voteRepository;
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.notificationManager = notificationManager;
        this.webPushRepository = webPushRepository;
        this.redis = redis;
        this.siteConfig = siteConfig;
        this.logger = logger;
        this.mailLogger = logger.child({service: 'MAIL'});
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

    public clearCache(userId: number) {
        const cacheEntry = this.cacheId[userId];
        if (!cacheEntry) {
            return;
        }
        delete this.cacheId[userId];
        delete this.cacheUsername[cacheEntry.username];
    }

    public clearUserRestrictionsCache(userId: number) {
        this.userRestrictionsCache.delete(userId);
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

    async getByUsernameWithVote(username: string, forUserId: number): Promise<UserInfo | undefined> {
        const infoWithoutVote = await this.getByUsername(username);
        if (!infoWithoutVote) {
            return;
        }
        const vote = await this.voteRepository.getUserVote(infoWithoutVote.id, forUserId);
        return {vote, ...infoWithoutVote};
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

        if (!userRaw || !await bcrypt.compare(password, userRaw.password)) {
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

    async getNumActiveUsersThatCanVote() {
        if (this.cachedNumActiveUsersThatCanVote.lastUpdateTs + this.cachedNumActiveUsersThatCanVote.expirationMs > Date.now()) {
            return this.cachedNumActiveUsersThatCanVote.value;
        }
        this.cachedNumActiveUsersThatCanVote.value = await this.userRepository.getNumActiveUsersThatCanVote();
        this.cachedNumActiveUsersThatCanVote.lastUpdateTs = Date.now();
        return this.cachedNumActiveUsersThatCanVote.value;
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
        return Math.max(-1000, ((contentRating + 1) * userRating - 1) * 1000);
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
            if (vote.vote !== 0 && await this.isUserActive(vote.voterId)) {
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

        let localCachedValue = this.userRestrictionsCache.get(userId);
        if (localCachedValue && localCachedValue.ts.getTime() < Date.now() - 1000 * 60 * 30 /* 30 minutes */) {
            localCachedValue = undefined;
        }

        const { MIN_KARMA, NEG_KARMA_THRESH, POS_KARMA_THRESH, NEW_USER_AGE_DAYS } = USER_RESTRICTIONS;

        // calculate days on site
        const user = await this.getById(userId);
        const daysOnSite = this.getDaysOnSite(user);
        const userIsNew = daysOnSite < NEW_USER_AGE_DAYS;

        const onTrial = user.ontrial;

        const effectiveKarmaWOPenalty = localCachedValue?.effectiveKarmaWOPenalty ?? await this.getUserEffectiveKarma(userId);
        const penalty = ~~(await this.redis.get(`karma_penalty_${userId}`)); // parses string to int or 0
        const effectiveKarma = Math.max(effectiveKarmaWOPenalty - penalty, MIN_KARMA);

        if (effectiveKarma < NEG_KARMA_THRESH) {
            await this.removeVotesWhenKarmaIsLow(userId);
        }

        const lastCommentTime = localCachedValue ? localCachedValue.lastCommentTime :
            await this.commentRepository.getLastUserComment(userId).then(comment => comment?.created_at);
        const lastOwnPost = localCachedValue ? localCachedValue.lastOwnPost :
            await this.postRepository.getLastUserPost(userId);

        const restrictedToPostId = effectiveKarma <= MIN_KARMA ? lastOwnPost?.post_id || true : false;
        const canCreatePosts = !Number.isFinite(restrictedToPostId);

        const postSlowModeDelay = (effectiveKarma < NEG_KARMA_THRESH ? /*12 hours */3600 * 12 : 0);
        const commentSlowModeDelay =
            effectiveKarma <= -1000 ? /*1 hour */3600 : (effectiveKarma < NEG_KARMA_THRESH ? /*10 minutes */ 10 * 60 : 0);

        if (!localCachedValue) {
            this.userRestrictionsCache.set(userId, {
                ts: new Date(),
                lastCommentTime,
                lastOwnPost,
                effectiveKarmaWOPenalty
            });
        }

        return {
            effectiveKarma,
            senatePenalty: penalty,

            postSlowModeWaitSec: canCreatePosts ? postSlowModeDelay : 0,
            postSlowModeWaitSecRemain: canCreatePosts && lastOwnPost ?
                Math.max(lastOwnPost.created_at.getTime() / 1000 - Date.now() / 1000 + postSlowModeDelay, 0) : 0,

            commentSlowModeWaitSec: commentSlowModeDelay,
            commentSlowModeWaitSecRemain: lastCommentTime ?
                Math.max(lastCommentTime.getTime() / 1000 - Date.now() / 1000 + commentSlowModeDelay, 0) : 0,

            restrictedToPostId,

            canVote: effectiveKarma >= NEG_KARMA_THRESH,
            canVoteKarma: effectiveKarma >= POS_KARMA_THRESH && !userIsNew && !onTrial,

            canInvite: (effectiveKarma >= POS_KARMA_THRESH && !userIsNew && !onTrial) || userId <= 1 /* Orbitar, Plotva */,

            canCreateSubsites: effectiveKarma > 0,
            canEditOwnContent: effectiveKarma > MIN_KARMA
        };
    }

    private mapUserRaw(rawUser: UserRaw): UserInfo {
        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name,
            registered: rawUser.registered_at,
            ontrial: rawUser.ontrial === 1,
        };
    }

    async sendResetPasswordEmail(email: string): Promise<boolean> {
        email = email.toLowerCase();
        const user = await this.userRepository.getUserByEmail(email);
        if (!user) {
            this.logger.error(`Failed to find user by email: ` + email);
            return false;
        }
        const code = await this.userRepository.generateAndSavePasswordResetForUser(user.user_id);
        if (!code) {
            this.logger.error(`Failed to generate password reset code for email: ` + email);
            return false;
        }
        return sendResetPasswordEmail(user.username, email, code, this.siteConfig, this.mailLogger);
    }

    async setNewPassword(password: string, code: string): Promise<boolean> {
        const userId = await this.checkIfPasswordResetCodeExists(code);
        if (!userId) {
            return false;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        return (
            await this.userRepository.updatePassword(passwordHash, userId) &&
            await this.userRepository.clearResetPasswordCode(code, userId) &&
            await this.userRepository.clearResetPasswordExpiredLinks()
        );
    }

    async checkIfPasswordResetCodeExists(code: string): Promise<number | undefined> {
        const user = await this.userRepository.getResetPasswordUserIdByResetCode(code);
        if (!user?.user_id) {
            return undefined;
        }
        return user.user_id;
    }

    async saveFeedSorting(site: string, feedSorting: FeedSorting, userId: number) {
        await this.userRepository.saveFeedSorting(site, feedSorting, userId);
    }

    async getFeedSorting(userId: number, siteId: number): Promise<FeedSorting | undefined> {
        return await this.userRepository.getFeedSorting(userId, siteId);
    }

    /**
     * Returns days passed since user registration as a float number of days
     * @param user
     */
    private getDaysOnSite(user: UserInfo): number {
        return (Date.now() - user.registered.getTime()) / (1000 * 60 * 60 * 24);
    }

    async getUserParent(userId: number): Promise<UserInfo|undefined> {
        // check cache
        const cachedParent = this.cachedUserParents[userId];
        if (cachedParent === false) {
            return undefined;
        } else if (cachedParent) {
            return this.getById(cachedParent);
        }
        const parent = await this.userRepository.getUserParent(userId);
        this.cachedUserParents[userId] = parent !== undefined ? parent.user_id : false;
        return this.getById(parent.user_id);
    }

    /**
     * Returns the array of votes counts where idx is the secondary vote value i.e. 0, 1, 2, 3 .. threshold
     *  and the value is the aggregated number of users with this vote value.
     * @param userId
     * @param threshold
     */
    async getTrialVoters(userId: number, threshold = 2): Promise<number[]> {
        const voters = await this.getActiveKarmaVotes(userId);

        const primaryVoters = new Map<number, { user: UserInfo, vote: number }>();
        for (const [username, vote] of Object.entries(voters)) {
            if (vote === 0) {
                continue;
            }
            const user = await this.getByUsername(username);
            primaryVoters.set(user.id, {
                vote,
                user
            });
        }
        const parent = await this.getUserParent(userId);
        if (parent && parent.id > 1 /* exclude admin accounts */ && !primaryVoters.has(parent.id)) {
            primaryVoters.set(parent.id, {
                vote: 2,
                user: parent
            });
        }

        const primaryIds = Array.from(primaryVoters.values()).map(v => v.user.id);

        /* includes inactive users! returns only votes that are <0 or == +2  */
        const secondaryVoters = await this.voteRepository.getSecondaryVotes(primaryIds);
        const secondaryVotesIdx = new Map<number, number>();
        const activityCache = new Map<number, boolean>();

        for (const {userId, voterId, vote} of secondaryVoters) {
            let active = activityCache.get(voterId);
            if (active === undefined) {
                active = await this.isUserActive(voterId);
                activityCache.set(voterId, active);
            }
            if (!active) {
                continue;
            }
            const primaryVote = primaryVoters.get(userId).vote;
            secondaryVotesIdx.set(voterId, (secondaryVotesIdx.get(voterId) || 0) +
                Math.sign(vote) * Math.sign(primaryVote));
        }
        for (const [voterId, {vote}] of primaryVoters.entries()) {
            /* make sure that direct votes override secondary votes */
            secondaryVotesIdx.set(voterId, Math.sign(vote) * threshold);
        }
        // array of threshold elements
        const result = new Array(threshold + 1).fill(0);
        for (const votes of secondaryVotesIdx.values()) {
            if (votes > 0) {
                result[Math.min(votes, threshold)]++;
            }
        }
        return result;
    }

    async getTrialProgressRaw(userId: number): Promise<TrialProgressDebugInfo> {
        const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

        const user = await this.getById(userId);
        const effectiveKarma = (await this.getUserRestrictions(userId)).effectiveKarma;
        const { POS_KARMA_THRESH, NEW_USER_AGE_DAYS } = USER_RESTRICTIONS;
        const effectiveKarmaPart = clamp(effectiveKarma, 0, POS_KARMA_THRESH) / POS_KARMA_THRESH;

        const daysOnSite = this.getDaysOnSite(user);
        const daysOnSitePart = clamp(daysOnSite, 0, NEW_USER_AGE_DAYS) / NEW_USER_AGE_DAYS;

        if (user?.ontrial) {
            const activeUserThatCanVoteNum = Math.max(await this.getNumActiveUsersThatCanVote(), 1);
            const secondaryVoters = await this.getTrialVoters(userId, 2);
            /* threshold of ratio votes/activeusers when progress reaches 1 */
            const SINGLE_VOTE_THRESHOLD = 0.5;
            const DOUBLE_VOTE_THRESHOLD = 0.3;

            /* both threshold should be reached */
            const singleVotesPart = Math.min(1, (secondaryVoters[1] + secondaryVoters[2]) / (activeUserThatCanVoteNum * SINGLE_VOTE_THRESHOLD));
            const doubleVotesPart = Math.min(1, (secondaryVoters[2]) / (activeUserThatCanVoteNum * DOUBLE_VOTE_THRESHOLD));

            return {
                effectiveKarmaPart,
                daysOnSitePart,
                singleVotesPart,
                doubleVotesPart,
            };
        } else {
            return {
                effectiveKarmaPart,
                daysOnSitePart,
                singleVotesPart: undefined,
                doubleVotesPart: undefined,
            };
        }
    }

    /**
     * Returns the progress of user trial based on the ratio of number of primary and secondary voters to all active users
     * @param userId user id to find the trial progress for
     * @param skipCache if true, then the cache will be skipped and the result will be recalculated
     * @return trial progress 0..1
     */
    async getTrialProgress(userId: number, skipCache = false) {
        // check redis cache
        const cacheKey = `trial_progress_${userId}`;
        if (!skipCache) {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return Number(cached);
            }
        }

        const {effectiveKarmaPart, singleVotesPart, doubleVotesPart, daysOnSitePart} = await this.getTrialProgressRaw(userId);
        const sharedPart = effectiveKarmaPart * 0.5 + daysOnSitePart * 0.5;

        const progress = singleVotesPart === undefined || doubleVotesPart === undefined ? effectiveKarmaPart :
            singleVotesPart * 0.25 + doubleVotesPart * 0.15 + sharedPart * 0.6;

        const cappedProgress = Math.min(Math.max(progress, 0), 1);

        await this.redis.set(cacheKey, cappedProgress);
        await this.redis.expire(cacheKey, 30 * 60 /* 30 minutes */);
        return cappedProgress;
    }

    /**
     * Checks if the user has enough votes to end the trial period and if so, ends it
     * @param userId
     * @param skipCache
     * @return number (trial progress 0..1) or undefined if trial ended
     */
    async tryEndTrial(userId: number, skipCache = false): Promise<number | undefined> {
        const trialProgress = await this.getTrialProgress(userId, skipCache);

        if (trialProgress >= 1 && (await this.getById(userId))?.ontrial) {
            await this.userRepository.endTrial(userId);
            this.clearCache(userId);
            this.clearUserRestrictionsCache(userId);
            return;
        }
        return trialProgress;
    }

    getTrialApprovers(userId: number): Promise<VoteWithUsername[]> {
        return this.voteRepository.getTrialsApprovers(userId);
    }
}
