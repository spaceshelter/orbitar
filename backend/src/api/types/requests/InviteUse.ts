import {UserEntity, UserGender} from '../entities/UserEntity';

export type InviteUseRequest = {
    code: string;
    username: string;
    name: string;
    email: string;
    gender: UserGender;
    password: string;
};

export type InviteUseResponse = {
    user: UserEntity;
    session: string;
};
