export enum UserGender {
    fluid,
    he,
    she,
}

export type User = {
    id: number;
    username: string;
    gender: UserGender;
    karma: number;
    name: string;
    vote?: number;
};

export type UserProfile = User & {
    registered: Date;
};

export type UserStats = {
    notifications: number;
    bookmarks: {
        posts: number;
        comments: number;
    }
};
