import PostManager from './PostManager';
import VoteRepository, {VoteWithUsername} from '../db/repositories/VoteRepository';
import {RedisClientType} from 'redis';
import UserManager from './UserManager';

export default class VoteManager {
    private voteRepository: VoteRepository;
    private postManager: PostManager;
    private userManager: UserManager;
    private redis: RedisClientType;

    constructor(voteRepository: VoteRepository, postManager: PostManager, userManager: UserManager, redis: RedisClientType) {
        this.voteRepository = voteRepository;
        this.postManager = postManager;
        this.userManager = userManager;
        this.redis = redis;
    }

    async postVote(postId: number, vote: number, userId: number): Promise<number> {
        return await this.voteRepository.postSetVote(postId, vote, userId);
    }

    async commentVote(commentId: number, vote: number, userId: number): Promise<number> {
        return await this.voteRepository.commentSetVote(commentId, vote, userId);
    }

    async userVote(toUserId: number, vote: number, voterId: number): Promise<number> {
        const res = await this.voteRepository.userSetVote(toUserId, vote, voterId);
        this.redis.del(`active_karma_votes_${toUserId}`).catch();
        this.userManager.clearCache(toUserId);
        this.userManager.clearUserRestrictionsCache(toUserId);
        await this.userManager.tryEndTrial(toUserId, true);
        return res;
    }

    async getPostVotes(postId: number): Promise<VoteWithUsername[]> {
        return await this.voteRepository.getPostVotes(postId);
    }

    async getCommentVotes(commentId: number): Promise<VoteWithUsername[]> {
        return await this.voteRepository.getCommentVotes(commentId);
    }

    async getUserVotes(userId: number): Promise<VoteWithUsername[]> {
        return await this.voteRepository.getUserVotes(userId);
    }

    getUserIdByVote(entityId: number, type: 'post' | 'comment' | 'user'): Promise<number | undefined> {
        switch (type) {
            case 'post':
                return this.postManager.getUserIdByPostId(entityId);
            case 'comment':
                return this.postManager.getUserIdByCommentId(entityId);
            case 'user':
                return Promise.resolve(entityId);
        }
    }
}
