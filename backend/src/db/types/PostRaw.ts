export type PostRaw = {
    post_id: number;
    site_id: number;
    author_id: number;
    rating: number;
    title: string;
    source: string;
    html: string;
    created_at: Date;
    commented_at: Date;
    comments: number;
};

export type PostRawWithUserData = PostRaw & {
    vote?: number;
    bookmark?: number;
    watch?: number;
    read_comments?: number;
    last_read_comment_id?: number;
};

export type CommentRaw = {
    comment_id: number;
    site_id: number;
    post_id: number;
    parent_comment_id: number | null;
    created_at: Date;
    author_id: number;
    deleted: number;
    source: string;
    html: string;
    rating: number;
};

export type CommentRawWithUserData = CommentRaw & {
    vote?: number;
    is_new?: boolean;
};
