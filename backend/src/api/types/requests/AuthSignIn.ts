import {UserBaseEntity} from '../entities/UserEntity';

export type AuthSignInRequest = {
    username: string;
    password: string;
};

export type AuthSignInResponse = {
    user: UserBaseEntity;
    session: string;
};
