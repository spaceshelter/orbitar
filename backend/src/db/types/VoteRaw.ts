type VoteRaw = {
    vote_id: number;
    voter_id: number;
    vote: number;
    voted_at: Date;
};

export type PostVoteRaw = VoteRaw & {
    post_id: number;
}

export type CommentVoteRaw = VoteRaw & {
    comment_id: number;
}

export type UserVoteRaw = VoteRaw & {
    user_id: number;
}
