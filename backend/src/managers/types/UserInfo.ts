export enum UserGender {
    fluid,
    he,
    she,
}

export type UserBaseInfo = {
    id: number;
    username: string;
    gender: UserGender;
};

export type UserInfo = UserBaseInfo & {
    karma: number;
    name: string;
    vote?: number;
};

export type UserProfile = UserInfo & {
    registered: Date;
};

export type UserStats = {
    notifications: number;
    watch: {
        posts: number;
        comments: number;
    }
};

export type UserRatingBySubsite = {
    postRatingBySubsite: Record<string, number>;
    commentRatingBySubsite: Record<string, number>;
};

export type UserRestrictions = {
    effectiveKarma: number;

    postSlowModeWaitSec: number; /* time to wait until can post */
    commentSlowModeWaitSec: number; /* time to wait until can comment */
    restrictedToPostId: number | true | false; /* if number: post id to restrict commenting to,
                                                  if true - restriction active, but no posts,
                                                  if false - no restriction */
    canVote: boolean; /* if user can vote for posts, comments and karma */
    canInvite: boolean; /* whether invites by this user should work */
};