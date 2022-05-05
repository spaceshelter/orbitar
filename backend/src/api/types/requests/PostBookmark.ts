export type PostBookmarkRequest = {
    post_id: number;
    bookmark: boolean;
};

export type PostBookmarkResponse = {
    bookmark: boolean;
};
