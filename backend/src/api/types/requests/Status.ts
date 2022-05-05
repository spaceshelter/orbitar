import {UserEntity} from '../entities/UserEntity';
import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type StatusRequest = {
    site: string;
};

export type StatusResponse = {
    user: UserEntity;
    site: SiteWithUserInfoEntity;
    watch: {
        posts: number;
        comments: number;
    };
    notifications: number;
};