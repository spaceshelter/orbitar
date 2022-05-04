export interface BookmarkRaw {
    user_id: number;
    post_id: number;
    last_read_comment_id: number;
    bookmark: number;
    watch: number;
    read_comments: number | null;
}
