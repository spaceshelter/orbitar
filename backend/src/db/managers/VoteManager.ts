import PostManager from './PostManager';
import VoteRepository from '../repositories/VoteRepository';

export default class VoteManager {
    private voteRepository: VoteRepository;
    private postManager: PostManager;

    constructor(voteRepository: VoteRepository, postManager: PostManager) {
        this.voteRepository = voteRepository;
        this.postManager = postManager;
    }

    async postVote(postId: number, vote: number, userId: number): Promise<number> {
        return await this.voteRepository.postSetVote(postId, vote, userId);
    }

    async commentVote(commentId: number, vote: number, userId: number): Promise<number> {
        return await this.voteRepository.commentSetVote(commentId, vote, userId);
    }

    async userVote(toUserId: number, vote: number, voterId: number): Promise<number> {
        return await this.voteRepository.userSetVote(toUserId, vote, voterId);
    }
}
