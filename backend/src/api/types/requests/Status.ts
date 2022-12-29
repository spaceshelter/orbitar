import {UserEntity} from '../entities/UserEntity';

export type StatusRequest = Record<string, never>;

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
