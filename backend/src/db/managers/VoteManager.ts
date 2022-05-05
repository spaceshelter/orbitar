import PostManager from './PostManager';
import VoteRepository, {VoteWithUsername} from '../repositories/VoteRepository';

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
