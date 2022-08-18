import {UserBaseEntity, UserProfileEntity} from '../entities/UserEntity';

export type UserProfileRequest = {
    username: string;
};

export type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy?: UserBaseEntity;
    invites: UserBaseEntity[];
};

export type UserKarmaResponse = {
    senatePenalty: number;
    activeKarmaVotes: Record<string, number>;
    postRatingBySubsite: Record<string, number>;
    commentRatingBySubsite: Record<string, number>;
};

/* see UserRestrictions */
export type UserRestrictionsResponse = {
    effectiveKarma: number;
    senatePenalty: number;
    postSlowModeWaitSec: number;
    postSlowModeWaitSecRemain: number;
    commentSlowModeWaitSec: number;
    commentSlowModeWaitSecRemain: number;
    restrictedToPostId: number | true | false;
    canVote: boolean;
    canVoteKarma: boolean;
    canInvite: boolean;
    canEditOwnContent: boolean;
};