import PostManager from './PostManager';
import VoteRepository, {VoteWithUsername} from '../db/repositories/VoteRepository';
import UserRepository from '../db/repositories/UserRepository';

export default class VoteManager {
    private voteRepository: VoteRepository;
    private postManager: PostManager;
    private userRepository: UserRepository;

    constructor(userRepository: UserRepository, voteRepository: VoteRepository, postManager: PostManager) {
        this.userRepository = userRepository;
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
