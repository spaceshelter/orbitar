export type PostBareBonesRaw = {
    post_id: number;
    site_id: number;
    created_at: Date;
    commented_at: Date;
};

export type PostRaw = {
    author_id: number;
    rating: number;
    title: string;
    source: string;
    html: string;
    edit_flag?: number;
    comments: number;
    gold: number;
    language: string;
    content_source_id: number;
    parser_version: number;
} & PostBareBonesRaw;

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
    edit_flag?: number;
    language: string;
    content_source_id: number;
    parser_version: number;
};

export type CommentRawWithUserData = CommentRaw & {
    vote?: number;
};
