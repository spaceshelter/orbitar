import PostManager from './PostManager';
import VoteRepository, {VoteWithUsername} from '../db/repositories/VoteRepository';
import {RedisClientType} from 'redis';

export default class VoteManager {
    private voteRepository: VoteRepository;
    private postManager: PostManager;
    private redis: RedisClientType;

    constructor(voteRepository: VoteRepository, postManager: PostManager, redis: RedisClientType) {
        this.voteRepository = voteRepository;
        this.postManager = postManager;
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
}
