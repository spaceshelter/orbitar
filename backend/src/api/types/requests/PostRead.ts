export type PostReadRequest = {
    post_id: number;
    comments: number;
    last_comment_id?: number;
};

export type PostReadResponse = {
    notifications?: number;
    watch?: {
        posts: number;
        comments: number;
    };
};