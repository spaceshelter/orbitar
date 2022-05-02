import DB from '../DB';
import {BookmarkRaw} from '../types/BookmarkRaw';

export default class BookmarkRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async setRead(postId: number, userId: number, readComments: number, lastCommentId?: number) {
        // TODO: add unique key (post_id, user_id) and change to 'insert ... on duplicate update ...'
        await this.db.inTransaction(async conn => {
            const bookmark = await conn.fetchOne<BookmarkRaw>(`select * from user_bookmarks where post_id=:post_id and user_id=:user_id`, {
                post_id: postId,
                user_id: userId
            });

            if (!bookmark) {
                await conn.query('insert into user_bookmarks (post_id, user_id, read_comments, last_comment_id) values(:post_id, :user_id, :read_comments, :last_comment_id)', {
                    post_id: postId,
                    user_id: userId,
                    read_comments: readComments,
                    last_comment_id: lastCommentId
                });
            }
            else {
                await conn.query('update user_bookmarks set read_comments=:read_comments, last_comment_id=:last_comment_id where bookmark_id=:bookmark_id', {
                    read_comments: readComments,
                    last_comment_id: lastCommentId ?? bookmark.last_comment_id,
                    bookmark_id: bookmark.bookmark_id
                });
            }
        });
    }

    async getBookmark(postId: number, userId: number): Promise<BookmarkRaw | undefined> {
        return await this.db.fetchOne<BookmarkRaw>(`select * from user_bookmarks where post_id=:post_id and user_id=:user_id`, {
            post_id: postId,
            user_id: userId
        });
    }

    async setBookmark(postId: number, userId: number, bookmarked: boolean) {
        // TODO: add unique key (post_id, user_id) and change to 'insert ... on duplicate update ...'
        await this.db.inTransaction(async conn => {
            const bookmark = await conn.fetchOne<BookmarkRaw>(`select * from user_bookmarks where post_id=:post_id and user_id=:user_id`, {
                post_id: postId,
                user_id: userId
            });

            if (!bookmark) {
                await conn.query('insert into user_bookmarks (post_id, user_id, bookmark) values(:post_id, :user_id, :bookmark)', {
                    post_id: postId,
                    user_id: userId,
                    bookmark: bookmarked ? 1 : 0
                });
            }
            else {
                await conn.query('update user_bookmarks set read_comments=:read_comments where bookmark=:bookmark', {
                    bookmark: bookmarked ? 1 : 0,
                    bookmark_id: bookmark.bookmark_id
                });
            }
        });
    }
}
