import {UserGender} from '../../managers/types/UserInfo';

export type UserRaw = {
    user_id: number;
    username: string;
    password: string;
    twofactor?: string;
    gender: UserGender;
    karma: number;
    name: string;
    registered_at: Date;
};

export type UserSiteRaw = {
    user_id: number;
    site_id: number;
    subscribed: Date;
    feed_main: number;
    feed_bookmarks: number;
};
