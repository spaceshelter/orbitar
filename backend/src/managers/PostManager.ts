import PostRepository from '../db/repositories/PostRepository';
import CommentRepository from '../db/repositories/CommentRepository';
import BookmarkRepository from '../db/repositories/BookmarkRepository';
import {CommentRawWithUserData, PostRaw} from '../db/types/PostRaw';
import {BookmarkRaw} from '../db/types/BookmarkRaw';
import SiteManager from './SiteManager';
import CodeError from '../CodeError';
import TheParser from '../parser/TheParser';
import {ContentFormat} from './types/common';
import FeedManager from './FeedManager';
import {PostInfo} from './types/PostInfo';
import NotificationManager from './NotificationManager';
import UserManager from './UserManager';
import {CommentInfoWithPostData} from './types/CommentInfo';
import {SiteInfo} from './types/SiteInfo';
import {HistoryInfo} from './types/HistoryInfo';
import TranslationManager from './TranslationManager';

export default class PostManager {
    private bookmarkRepository: BookmarkRepository;
    private commentRepository: CommentRepository;
    private postRepository: PostRepository;
    private feedManager: FeedManager;
    private notificationManager: NotificationManager;
    private siteManager: SiteManager;
    private userManager: UserManager;
    private translationManager: TranslationManager;
    private parser: TheParser;

    private numberOfPostsCache: Record<number, ContentNumberCache> = {};
    private numberOfCommentsCache: Record<number, ContentNumberCache> = {};

    constructor(
        bookmarkRepository: BookmarkRepository, commentRepository: CommentRepository, postRepository: PostRepository,
        feedManager: FeedManager, notificationManager: NotificationManager, siteManager: SiteManager, userManager: UserManager,
        translationManager: TranslationManager,
        parser: TheParser
    ) {
        this.bookmarkRepository = bookmarkRepository;
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.feedManager = feedManager;
        this.notificationManager = notificationManager;
        this.siteManager = siteManager;
        this.userManager = userManager;
        this.translationManager = translationManager;
        this.parser = parser;
    }

    async getPost(postId: number, forUserId: number, format: ContentFormat): Promise<PostInfo | undefined> {
        const [rawPost] = await this.postRepository.getPostsWithUserData([postId], forUserId);
        return (await this.feedManager.convertRawPost(forUserId, [rawPost], format))[0];
    }

    async getPostsByUser(userId: number, forUserId: number, filter: string, page: number, perpage: number, format: ContentFormat): Promise<PostInfo[]> {
        const posts = await this.postRepository.getPostsByUser(userId, forUserId, filter, page, perpage);
        return await this.feedManager.convertRawPost(forUserId, posts, format);
    }

    getPostWithoutUserData(postId: number): Promise<PostRaw | undefined> {
        return this.postRepository.getPost(postId);
    }

    async getPostsByUserTotal(userId: number, filter: string): Promise<number> {
        if (!this.numberOfPostsCache[userId]) {
            this.numberOfPostsCache[userId] = new ContentNumberCache();
        }
        return await this.numberOfPostsCache[userId].getOrUpdate(filter,
            () => this.postRepository.getPostsByUserTotal(userId, filter));
    }

    async createPost(siteName: string, userId: number, title: string, content: string, main: boolean, format: ContentFormat): Promise<PostInfo> {
        const site = await this.siteManager.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const parseResult = this.parser.parse(content);
        const language = await this.translationManager.detectLanguage(title, parseResult.text);
        this.userManager.clearUserRestrictionsCache(userId);
        const postRaw = await this.postRepository.createPost(site.id, userId, title, content, language, parseResult.text, main || site.id === 1);

        await this.bookmarkRepository.setWatch(postRaw.post_id, userId, true);

        for (const mention of parseResult.mentions) {
            await this.notificationManager.sendMentionNotify(mention, userId, postRaw.post_id);
        }

        // fan out in background
        this.feedManager.postFanOut(postRaw.site_id, postRaw.main === 1, postRaw.post_id,
            postRaw.created_at, postRaw.created_at
        ).then().catch();

        delete this.numberOfPostsCache[userId];

        return {
            id: postRaw.post_id,
            site: site.site,
            author: postRaw.author_id,
            created: postRaw.created_at,
            title: postRaw.title,
            content: format === 'html' ? postRaw.html : postRaw.source,
            main: postRaw.main === 1,
            rating: 0,
            comments: 0,
            newComments: 0,
            vote: 0,
            bookmark: false,
            watch: true
        };
    }

    async editPost(forUserId: number, postId: number, title: string | undefined, content: string, siteName: string, main: boolean, format: ContentFormat): Promise<PostInfo> {
        const site = await this.siteManager.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const [rawPost] = await this.postRepository.getPostsWithUserData([postId], forUserId);
        if (rawPost.author_id !== forUserId) {
            throw new CodeError('access-denied', 'Access denied');
        }

        if (rawPost.source === content && rawPost.title === title && rawPost.main === (main || site.id === 1 ? 1 : 0) && rawPost.site_id === site.id) {
            // nothing changed
            const [post] = await this.feedManager.convertRawPost(forUserId, [rawPost], format);
            return post;
        }

        const html = (await this.parser.parse(content)).text;
        const language = await this.translationManager.detectLanguage(title, html);

        const updated = await this.postRepository.updatePostText(forUserId, postId, title, content, language, html,
            site.id, main || site.id === 1);
        if (!updated) {
            throw new CodeError('unknown', 'Could not edit post');
        }

        const [updatedRawPost] = await this.postRepository.getPostsWithUserData([postId], forUserId);

        if (rawPost.site_id !== updatedRawPost.site_id || rawPost.main !== updatedRawPost.main) {
            // in background
            this.feedManager.removePostFromFeed(rawPost.site_id, rawPost.main === 1, rawPost.post_id)
                .then(() =>
                    this.feedManager.postFanOut(updatedRawPost.site_id,
                        updatedRawPost.main === 1,
                        postId,
                        updatedRawPost.created_at, updatedRawPost.created_at)
                ).then().catch();
        }

        const [post] = await this.feedManager.convertRawPost(forUserId, [updatedRawPost], format);

        return post;
    }

    async getPostComments(postId: number, forUserId: number, format: ContentFormat): Promise<CommentInfoWithPostData[]> {
        const rawComments = await this.commentRepository.getPostComments(postId, forUserId);
        return await this.convertRawCommentsWithPostData(forUserId, rawComments, format);
    }

    async getParentCommentsForASetOfComments(comments: CommentInfoWithPostData[], forUserId: number, format: ContentFormat): Promise<CommentInfoWithPostData[]> {
        const commentIds = comments.flatMap(comment => comment.parentComment ? [comment.parentComment] : []);
        if (!commentIds.length) {
            return [];
        }
        const rawComments = await this.commentRepository.getComments(commentIds);
        return await this.convertRawCommentsWithPostData(forUserId, rawComments, format);
    }

    async getUserComments(userId: number, forUserId: number, filter: string, page: number, perpage: number, format: ContentFormat): Promise<CommentInfoWithPostData[]> {
        const rawComments = await this.commentRepository.getUserComments(userId, forUserId, filter, page, perpage);
        return await this.convertRawCommentsWithPostData(forUserId, rawComments, format);
    }

    private async convertRawCommentsWithPostData(forUserId: number, rawComments: CommentRawWithUserData[], format: ContentFormat): Promise<CommentInfoWithPostData[]> {
        const siteById: Record<number, SiteInfo> = {};
        const comments: CommentInfoWithPostData[] = [];

        for (const raw of rawComments) {
            let site = siteById[raw.site_id];
            if (!site) {
                site = await this.siteManager.getSiteById(raw.site_id);
                siteById[raw.site_id] = site;
            }

            const comment: CommentInfoWithPostData = {
                id: raw.comment_id,
                post: raw.post_id,
                site: site ? site.site : '',
                content: format === 'html' ? raw.html : raw.source,
                author: raw.author_id,
                created: raw.created_at,
                rating: raw.rating,
                parentComment: raw.parent_comment_id,
                language: raw.language,

                vote: raw.vote,
            };
            if (raw.deleted) {
                comment.deleted = true;
            }
            if (raw.author_id === forUserId) {
                comment.canEdit = true;
            }
            if (raw.edit_flag) {
                comment.editFlag = raw.edit_flag;
            }

            comments.push(comment);
        }

        return comments;
    }

    async getUserCommentsTotal(userId: number, filter = ''): Promise<number> {
        if (!this.numberOfCommentsCache[userId]) {
            this.numberOfCommentsCache[userId] = new ContentNumberCache();
        }
        return await this.numberOfCommentsCache[userId].getOrUpdate(filter,
            () => this.commentRepository.getUserCommentsTotal(userId, filter));
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, content: string, format: ContentFormat): Promise<CommentInfoWithPostData> {
        const parseResult = this.parser.parse(content);
        const language = await this.translationManager.detectLanguage('', parseResult.text);

        const commentRaw = await this.commentRepository.createComment(userId, postId, parentCommentId, content, language, parseResult.text);
        const postRaw = await this.postRepository.getPost(postId);
        this.userManager.clearUserRestrictionsCache(userId);

        for (const mention of parseResult.mentions) {
            await this.notificationManager.sendMentionNotify(mention, userId, postId, commentRaw.comment_id);
        }

        if (parentCommentId) {
            await this.notificationManager.sendAnswerNotify(parentCommentId, userId, postId, commentRaw.comment_id);
        }

        await this.bookmarkRepository.setWatch(postId, userId, true);

        // fan out in background
        this.feedManager.postFanOut(commentRaw.site_id,
            postRaw.main === 1,
            commentRaw.post_id,
            undefined,
            commentRaw.created_at
        ).then().catch();

        const comments = await this.convertRawCommentsWithPostData(userId, [commentRaw], format);
        delete this.numberOfCommentsCache[userId];
        return comments[0];
    }

    async getComment(forUserId: number, commentId: number, format: ContentFormat): Promise<CommentInfoWithPostData | undefined> {
        const rawComment = await this.commentRepository.getCommentWithUserData(forUserId, commentId);
        const [comment] = await this.convertRawCommentsWithPostData(forUserId, [rawComment], format);
        return comment;
    }

    async editComment(forUserId: number, commentId: number, content: string, format: ContentFormat): Promise<CommentInfoWithPostData> {
        let rawComment = await this.commentRepository.getCommentWithUserData(forUserId, commentId);
        if (rawComment.author_id !== forUserId) {
            throw new CodeError('access-denied', 'Access denied');
        }

        if (rawComment.source === content) {
            // nothing changed
            const [comment] = await this.convertRawCommentsWithPostData(forUserId, [rawComment], format);
            return comment;
        }

        const html = (await this.parser.parse(content)).text;
        const language = await this.translationManager.detectLanguage('', html);

        const updated = await this.commentRepository.updateCommentText(forUserId, commentId, content, language, html);
        if (!updated) {
            throw new CodeError('unknown', 'Could not edit comment');
        }

        rawComment = await this.commentRepository.getCommentWithUserData(forUserId, commentId);
        const [comment] = await this.convertRawCommentsWithPostData(forUserId, [rawComment], format);
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

    async getHistory(forUserId: number, id: number, type: string, format: ContentFormat): Promise<HistoryInfo[]> {
        const rawSources = await this.postRepository.getContentSources(id, type);
        const sources: HistoryInfo[] = [];

        for (const rawSource of rawSources) {
            let content = rawSource.source;
            if (format === 'html') {
                content = (await this.parser.parse(content)).text;
            }

            const source: HistoryInfo = {
                id: rawSource.content_source_id,
                content,
                title: rawSource.title,
                comment: rawSource.comment,
                date: rawSource.created_at,
                changed: 0,
                editor: rawSource.author_id
            };
            sources.push(source);
        }

        return sources;
    }
}

class ContentNumberCache {
    filtered?: [string, number];
    total?: number;

    async getOrUpdate(filter: string, set: () => Promise<number>): Promise<number> {
        if (filter !== '') {
            if (this.filtered && this.filtered[0] === filter) {
                return this.filtered[1];
            }
            this.filtered = [filter, await set()];
            return this.filtered[1];
        }
        if (this.total === undefined) {
            this.total = await set();
        }
        return this.total;
    }
}
