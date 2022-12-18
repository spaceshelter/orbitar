export enum UserGender {
    fluid,
    he,
    she,
}

export type UserBaseInfo = {
    id: number;
    username: string;
    gender: UserGender;
    bio_source: string;
    bio_html: string;
};

export type UserInfo = UserBaseInfo & {
    name: string;
    karma: number;
    vote?: number;
};

export type UserProfileInfo = UserInfo & {
    registered: Date;
    active: boolean;
};

