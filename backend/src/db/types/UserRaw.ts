import {UserGender} from '../../managers/types/UserInfo';

export type UserBaseRaw = {
    user_id: number;
    username: string;
};

export type UserRaw = UserBaseRaw & {
    password: string;
    twofactor?: string;
    gender: UserGender;
    karma: number;
    ontrial: number;
    name: string;
    registered_at: Date;
    bio_source?: string;
    bio_html?: string;
};

export type UserSiteRaw = {
    user_id: number;
    site_id: number;
    subscribed: Date;
    feed_main: number;
    feed_bookmarks: number;
};
