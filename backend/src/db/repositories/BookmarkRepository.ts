import DB from '../DB'
import { BookmarkRaw } from '../types/BookmarkRaw'
import { PostBareBonesRaw, PostRaw, PostRawWithUserData } from '../types/PostRaw'

export default class BookmarkRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async setRead(postId: number, userId: number, readComments: number, lastCommentId?: number): Promise<boolean> {
    return await this.db.inTransaction(async (conn) => {
      const fetchedBookmark = await conn.fetchOne<{ last_read_comment_id: number; read_comments: number }>(
        `select last_read_comment_id, read_comments from user_bookmarks where post_id=:post_id and user_id=:user_id`,
        {
          post_id: postId,
          user_id: userId,
        },
      )

      if (fetchedBookmark) {
        if (lastCommentId && lastCommentId <= fetchedBookmark.last_read_comment_id) {
          // expired request, no need to update
          return false
        }

        if (readComments <= fetchedBookmark.read_comments) {
          // already read more than requested
          return false
        }

        if (!lastCommentId) {
          lastCommentId = fetchedBookmark.last_read_comment_id
        }
      }

      if (!lastCommentId) {
        lastCommentId = 0
      }

      // select count of comments less or equal to lastCommentId
      const actualReadCountResult = await conn.fetchOne<{ cnt: string }>(
        `select count(*) cnt from comments where post_id=:post_id and (comment_id <= :last_read_comment_id or author_id=:author_id)`,
        {
          post_id: postId,
          last_read_comment_id: lastCommentId,
          author_id: userId,
        },
      )

      const actualReadCount = parseInt(actualReadCountResult?.cnt || '0')

      // finally update counter
      if (fetchedBookmark) {
        await conn.query(
          `
                    update user_bookmarks set read_comments = :read_comments, last_read_comment_id = :last_read_comment_id
                    where user_id=:user_id and post_id=:post_id
                `,
          {
            post_id: postId,
            user_id: userId,
            read_comments: actualReadCount,
            last_read_comment_id: lastCommentId,
          },
        )
      } else {
        await conn.query(
          `
                    insert into user_bookmarks (post_id, user_id, read_comments, last_read_comment_id)
                    values (:post_id, :user_id, :read_comments, :last_read_comment_id)
                `,
          {
            post_id: postId,
            user_id: userId,
            read_comments: actualReadCount,
            last_read_comment_id: lastCommentId,
          },
        )
      }

      return true
    })
  }

  async getBookmark(postId: number, userId: number): Promise<BookmarkRaw | undefined> {
    return await this.db.fetchOne<BookmarkRaw>(
      `select * from user_bookmarks where post_id=:post_id and user_id=:user_id`,
      {
        post_id: postId,
        user_id: userId,
      },
    )
  }

  async getBookmarkedPostsTotal(userId: number): Promise<string | undefined> {
    const result = await this.db.fetchOne<{ cnt: string }>(
      `select count(*) cnt from user_bookmarks where user_id=:user_id AND bookmark = 1`,
      {        
        user_id: userId,
      },
    )    
    return result?.cnt
  }

  async getBookmarkedPosts(userId: number, page: number, perpage: number): Promise<PostRawWithUserData[]> {
    if (!userId) {
      return []
    }
    const limitFrom = (page - 1) * perpage    
    
    return this.db.fetchAll<PostRawWithUserData>(
      `
      SELECT p.*, v.vote, b.read_comments, b.bookmark, b.last_read_comment_id
      FROM user_bookmarks b
      JOIN posts p ON p.post_id = b.post_id
      LEFT JOIN post_votes v ON (v.post_id = p.post_id AND v.voter_id = :user_id)
      WHERE b.user_id = :user_id 
      AND b.bookmark = 1     
      ORDER BY p.created_at DESC
      LIMIT :limit_from, :limit_count
      `,
      {
        user_id: userId,
        limit_from: limitFrom,
        limit_count: perpage        
      }
    )
  }

  async setBookmark(postId: number, userId: number, bookmarked: boolean) {
    await this.db.query(
      `
            insert into user_bookmarks (post_id, user_id, bookmark)
            values (:post_id, :user_id, :bookmark)
            on duplicate key update bookmark = :bookmark
        `,
      {
        post_id: postId,
        user_id: userId,
        bookmark: bookmarked ? 1 : 0,
      },
    )
  }

  async setWatch(postId: number, userId: number, watch: boolean) {
    await this.db.query(
      `
            insert into user_bookmarks (post_id, user_id, watch)
            values (:post_id, :user_id, :watch)
            on duplicate key update watch = :watch
        `,
      {
        post_id: postId,
        user_id: userId,
        watch: watch ? 1 : 0,
      },
    )
  }

  setUpdated(postId: number, date: Date) {
    return this.db.query(
      `
            update user_bookmarks set post_updated_at=:post_updated_at where post_id=:post_id
        `,
      {
        post_id: postId,
        post_updated_at: date,
      },
    )
  }
}
