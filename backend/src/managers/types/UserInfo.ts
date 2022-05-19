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
