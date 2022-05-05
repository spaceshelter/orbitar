import {UserBaseEntity, UserProfileEntity} from '../entities/UserEntity';

export type UserProfileRequest = {
    username: string;
};

export type UserProfileResponse = {
    profile: UserProfileEntity;
    invitedBy?: UserBaseEntity;
    invites: UserBaseEntity[];
};
