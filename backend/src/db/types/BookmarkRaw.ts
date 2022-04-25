export interface BookmarkRaw {
    bookmark_id: number;
    user_id: number;
    post_id: number;
    last_comment_id: number | null;
    bookmark: number;
    read_comments: number | null;
}
