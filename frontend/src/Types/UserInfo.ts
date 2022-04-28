export enum UserGender {
    fluid,
    he,
    she,
}

export type UserInfo = {
    id: number;
    username: string;
    gender: UserGender;
    name: string;
    karma: number;
    vote?: number;
}

export type UserProfileInfo = UserInfo & {
    registered: Date;
}
