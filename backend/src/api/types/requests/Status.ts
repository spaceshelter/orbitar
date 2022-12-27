import {UserEntity} from '../entities/UserEntity';
import {SiteWithUserInfoEntity} from '../entities/SiteEntity';

export type StatusRequest = {};

export type StatusResponse = {
    user: UserEntity;
    watch: {
        posts: number;
        comments: number;
    };
    notifications: {
        unread: number;
        visible: number;
    }
    subscriptions: SiteWithUserInfoEntity[];
};
