export enum UserGender {
    fluid,
    he,
    she,
}

export type UserBaseInfo = {
    id: number;
    username: string;
};

export type UserInfo = UserBaseInfo & {
    gender: UserGender;
    karma: number;
    name: string;
    vote?: number;
};

export type UserProfile = UserInfo & {
    registered: Date;
};

export type UserStats = {
    notifications: number;
    watch: {
        posts: number;
        comments: number;
    }
};
