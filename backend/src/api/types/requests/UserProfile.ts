import {UserBaseEntity, UserGender, UserProfileEntity} from '../entities/UserEntity';
import {VoteListItemEntity} from '../entities/VoteEntity';

export type UserProfileRequest = {
    username: string;
};

export type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy?: UserBaseEntity;
    invitedReason? : string;
    trialApprovers?: VoteListItemEntity[];
    trialProgress?: number;
    numberOfPosts: number;
    numberOfComments: number;
    numberOfInvitesAvailable?: number;

    invites: UserProfileEntity[];
    isBarmalini?: boolean;

    publicKey: string;

    visitedDaysAgo: number;
};

export type TrialProgressDebugInfo = {
    effectiveKarmaPart: number;
    daysOnSitePart: number;
    singleVotesPart?: number;
    doubleVotesPart?: number
};

export type UserKarmaResponse = {
    effectiveKarma: number;
    effectiveKarmaUserRating: number;
    effectiveKarmaContentRating: number;
    senatePenalty: number;
    activeKarmaVotes: Record<string, number>;
    postRatingBySubsite: Record<string, number>;
    commentRatingBySubsite: Record<string, number>;
    trialProgress: TrialProgressDebugInfo;
    totalNormalizedContentRating: number;
    contentVotersNum: number
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
    canCreateSubsites: boolean;
};

export type UserSaveBioRequest = {
    bio: string;
};

export type UserSaveBioResponse = {
    bio: string;
};

export type UserSaveNameRequest = {
    name: string;
};

export type UserSaveNameResponse = {
    name: string;
};

export type UserSaveGenderRequest = {
    gender: UserGender;
};

export type UserSaveGenderResponse = {
    gender: UserGender;
};

export type UserSavePublicKeyRequest = {
    publicKey: string;
};

export type UserSavePublicKeyResponse = {
    publicKey: string;
};

export type BarmaliniPasswordRequest = Record<string, unknown>;

export type BarmaliniPasswordResponse = {
    login: string;
    password: string;
};
