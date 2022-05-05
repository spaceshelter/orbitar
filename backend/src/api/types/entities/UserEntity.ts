export enum UserGender {
    fluid,
    he,
    she,
}

export type UserBaseEntity = {
    id: number;
    username: string;
    gender: UserGender;
    karma: number;
};

export type UserEntity = UserBaseEntity & {
    name?: string;
    vote?: number;
};

export type UserProfileEntity = UserEntity & {
    registered: string;
};