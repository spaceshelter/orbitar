import PostRepository from '../db/repositories/PostRepository';
import CommentRepository from '../db/repositories/CommentRepository';
import BookmarkRepository from '../db/repositories/BookmarkRepository';
import {CommentRawWithUserData, PostRawWithUserData} from '../db/types/PostRaw';
import {BookmarkRaw} from '../db/types/BookmarkRaw';
import SiteManager from './SiteManager';
import CodeError from '../CodeError';
import TheParser from '../parser/TheParser';
import {ContentFormat} from './types/common';
import FeedManager from './FeedManager';
import {PostInfo} from './types/PostInfo';
import NotificationManager from './NotificationManager';
import {PostEntity} from '../api/types/entities/PostEntity';
import {UserEntity} from '../api/types/entities/UserEntity';
import {SiteBaseEntity} from '../api/types/entities/SiteEntity';
import UserManager from './UserManager';
import {CommentEntity} from "../api/types/entities/CommentEntity";

export interface EnrichedPosts {
    posts: PostEntity[]
    users: Record<number, UserEntity>
    sites: Record<number, SiteBaseEntity>
}

export interface EnrichedComments {
    rootComments: CommentEntity[]
    allComments: CommentEntity[]
    commentsIndex: Record<number, CommentEntity>
    users: Record<number, UserEntity>
    sites: Record<number, SiteBaseEntity>
}

export default class PostManager {
    private bookmarkRepository: BookmarkRepository;
    private commentRepository: CommentRepository;
    private postRepository: PostRepository;
    private feedManager: FeedManager;
    private notificationManager: NotificationManager;
    private siteManager: SiteManager;
    private userManager: UserManager;
    private parser: TheParser;

    constructor(
        bookmarkRepository: BookmarkRepository, commentRepository: CommentRepository, postRepository: PostRepository,
        feedManager: FeedManager, notificationManager: NotificationManager, siteManager: SiteManager, userManager: UserManager,
        parser: TheParser
    ) {
        this.bookmarkRepository = bookmarkRepository;
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.feedManager = feedManager;
        this.notificationManager = notificationManager;
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.parser = parser;
    }

    getPost(postId: number, forUserId: number): Promise<PostRawWithUserData | undefined> {
        return this.postRepository.getPostWithUserData(postId, forUserId);
    }

    getPostsByUser(userId: number, forUserId: number, page: number, perpage: number): Promise<PostRawWithUserData[]> {
        return this.postRepository.getPostsByUser(userId, forUserId, page, perpage);
    }

    getPostsByUserTotal(userId: number): Promise<number> {
        return this.postRepository.getPostsByUserTotal(userId);
    }

    async createPost(siteName: string, userId: number, title: string, content: string, format: ContentFormat): Promise<PostInfo> {
        const site = await this.siteManager.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const parseResult = this.parser.parse(content);
        const postRaw = await this.postRepository.createPost(site.id, userId, title, content, parseResult.text);

        await this.bookmarkRepository.setWatch(postRaw.post_id, userId, true);

        for (const mention of parseResult.mentions) {
            await this.notificationManager.sendMentionNotify(mention, userId, postRaw.post_id);
        }

        // fan out in background
        this.feedManager.postFanOut(postRaw.post_id).then().catch();

        return {
            id: postRaw.post_id,
            site: site.site,
            author: postRaw.author_id,
            created: postRaw.created_at,
            title: postRaw.title,
            content: format === 'html' ? postRaw.html : postRaw.source,
            rating: 0,
            comments: 0,
            newComments: 0,
            vote: 0,
            bookmark: false,
            watch: true
        };
    }

    getPostComments(postId: number, forUserId: number): Promise<CommentRawWithUserData[]> {
        return this.commentRepository.getPostComments(postId, forUserId);
    }

    getUserComments(userId: number, forUserId: number, page: number, perpage: number): Promise<CommentRawWithUserData[]> {
        return this.commentRepository.getUserComments(userId, forUserId, page, perpage);
    }

    getUserCommentsTotal(userId: number): Promise<number> {
        return this.commentRepository.getUserCommentsTotal(userId);
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, content: string, format: ContentFormat): Promise<CommentEntity> {
        const parseResult = this.parser.parse(content);

        const commentRaw = await this.commentRepository.createComment(userId, postId, parentCommentId, content, parseResult.text);

        for (const mention of parseResult.mentions) {
            await this.notificationManager.sendMentionNotify(mention, userId, postId, commentRaw.comment_id);
        }

        if (parentCommentId) {
            await this.notificationManager.sendAnswerNotify(parentCommentId, userId, postId, commentRaw.comment_id);
        }

        await this.bookmarkRepository.setWatch(postId, userId, true);

        // fan out in background
        this.feedManager.postFanOut(commentRaw.post_id).then().catch();

        const { allComments : [comment] } = await this.enrichRawComments([commentRaw], {}, format, () => true);
        return comment;
    }

    async setRead(postId: number, userId: number, readComments: number, lastCommentId?: number): Promise<boolean> {
        const changedNotifications = await this.notificationManager.setReadForPost(userId, postId);
        const changedBookmarks = await this.bookmarkRepository.setRead(postId, userId, readComments, lastCommentId);
        return changedNotifications || changedBookmarks;
    }

    preview(content: string): string {
        return this.parser.parse(content).text;
    }

    getBookmark(postId: number, userId: number): Promise<BookmarkRaw | undefined> {
        return this.bookmarkRepository.getBookmark(postId, userId);
    }

    setBookmark(postId: number, userId: number, bookmarked: boolean) {
        return this.bookmarkRepository.setBookmark(postId, userId, bookmarked);
    }

    setWatch(postId: number, userId: number, bookmarked: boolean) {
        return this.bookmarkRepository.setWatch(postId, userId, bookmarked);
    }

    async enrichRawPosts(rawPosts: PostRawWithUserData[], format: string): Promise<EnrichedPosts> {
        const sites: Record<number, SiteBaseEntity> = {};
        const users: Record<number, UserEntity> = {};
        const posts: PostEntity[] = [];
        for (const post of rawPosts) {
            if (!users[post.author_id]) {
                users[post.author_id] = await this.userManager.getById(post.author_id);
            }

            let siteName = '';
            if (!sites[post.site_id]) {
                const site = await this.siteManager.getSiteById(post.site_id);
                siteName = site?.site || '';
            }
            else {
                siteName = sites[post.site_id].site;
            }


            posts.push({
                    id: post.post_id,
                    site: siteName,
                    author: post.author_id,
                    created: post.created_at.toISOString(),
                    title: post.title,
                    content: format === 'html' ? post.html : post.source,
                    rating: post.rating,
                    comments: post.comments,
                    newComments: post.read_comments ? Math.max(0, post.comments - post.read_comments) : post.comments,
                    bookmark: !!post.bookmark,
                    watch: !!post.watch,
                    vote: post.vote
                });
        }

        return {
            posts,
            users,
            sites
        };
    }

    async enrichRawComments(rawComments: CommentRawWithUserData[],
                            users: Record<number, UserEntity>,
                            format: string,
                            isNew: (CommentEntity) => boolean): Promise<EnrichedComments> {

        const commentsIndex: Record<number, CommentEntity> = {};
        const rootComments: CommentEntity[] = [];
        const allComments: CommentEntity[] = [];
        const sites: Record<number, SiteBaseEntity> = {};

        for (const rawComment of rawComments) {
            const comment: CommentEntity = {
                id: rawComment.comment_id,
                created: rawComment.created_at.toISOString(),
                author: rawComment.author_id,
                content: format === 'html' ? rawComment.html : rawComment.source,
                rating: rawComment.rating,
                site_id: rawComment.site_id,
                post_id: rawComment.post_id,
                vote: rawComment.vote,
                isNew: isNew(rawComment)
            };

            users[rawComment.author_id] = users[rawComment.author_id] || await this.userManager.getById(rawComment.author_id);
            sites[rawComment.site_id] = sites[rawComment.site_id] || await this.siteManager.getSiteById(rawComment.site_id);
            commentsIndex[rawComment.comment_id] = comment;

            if (!rawComment.parent_comment_id) {
                rootComments.push(comment);
            }
            else {
                const parentComment = commentsIndex[rawComment.parent_comment_id];
                if (parentComment) {
                    if (!parentComment.answers) {
                        parentComment.answers = [];
                    }

                    parentComment.answers.push(comment);
                }
            }
            allComments.push(comment);
        }
        return {
            allComments,
            commentsIndex,
            rootComments,
            users,
            sites
        };
    }
}
