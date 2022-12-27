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
    ontrial: boolean;
    karma: number;
    name: string;
    vote?: number;
    registered: Date;
    bio_source?: string;
    bio_html?: string;
};

export type UserStats = {
    notifications: {
        unread: number;
        visible: number;
    }
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
    senatePenalty: number;

    postSlowModeWaitSec: number; /* time to wait between posts */
    postSlowModeWaitSecRemain: number; /* actual time remaining time to wait until can post */

    commentSlowModeWaitSec: number; /* time to wait between comments */
    commentSlowModeWaitSecRemain: number; /* actual time remaining to wait until can comment */

    restrictedToPostId: number | true | false; /* if number: post id to restrict commenting to,
                                                  if true - restriction active, but no posts,
                                                  if false - no restriction */
    canVote: boolean; /* if user can vote for posts, comments*/
    canVoteKarma: boolean; /* if user can vote for karma */
    canInvite: boolean; /* whether invites by this user should work */
    canCreateSubsites: boolean; /* whether this user can create subsites */
    canEditOwnContent: boolean; /* whether this user can edit own content */
};