export interface PostRaw {
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
}

export interface CommentRaw {
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
}