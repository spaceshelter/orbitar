import {FeedSortingSettingsBySite} from './FeedSortingSettings';

export enum UserGender {
    fluid,
    he,
    she,
}

export type UserBaseInfo = {
    id: number;
    username: string;
    gender: UserGender;
};

export type UserInfo = UserBaseInfo & {
    name: string;
    karma: number;
    vote?: number;
    feedSortingSettings?: FeedSortingSettingsBySite;
};

export type UserProfileInfo = UserInfo & {
    registered: Date;
    active: boolean;
};

