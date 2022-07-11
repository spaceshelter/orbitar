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
    activeKarmaVotes: Record<string, number>;
    postRatingBySubsite: Record<string, number>;
    commentRatingBySubsite: Record<string, number>;
};

/* see UserRestrictions */
export type UserRestrictionsResponse = {
    effectiveKarma: number;
    postSlowModeWaitSec: number;
    commentSlowModeWaitSec: number;
    restrictedToPostId: number | true | false;
};