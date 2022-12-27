import {UserEntity} from '../entities/UserEntity';

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
};
