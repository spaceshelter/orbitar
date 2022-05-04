import PostRepository from '../repositories/PostRepository';
import CommentRepository from '../repositories/CommentRepository';
import BookmarkRepository from '../repositories/BookmarkRepository';
import {CommentRawWithUserData, PostRawWithUserData} from '../types/PostRaw';
import {BookmarkRaw} from '../types/BookmarkRaw';
import {PostEntity} from '../../api/entities/PostEntity';
import SiteManager from './SiteManager';
import CodeError from '../../CodeError';
import TheParser from '../../parser/TheParser';
import {ContentFormat} from '../../types/common';
import {CommentEntity} from '../../api/entities/CommentEntity';
import FeedManager from './FeedManager';


export default class PostManager {
    private bookmarkRepository: BookmarkRepository;
    private commentRepository: CommentRepository;
    private postRepository: PostRepository;
    private feedManager: FeedManager;
    private siteManager: SiteManager;
    private parser: TheParser;

    constructor(bookmarkRepository: BookmarkRepository, commentRepository: CommentRepository, postRepository: PostRepository, feedManager: FeedManager, siteManager: SiteManager, parser: TheParser) {
        this.bookmarkRepository = bookmarkRepository;
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.feedManager = feedManager;
        this.siteManager = siteManager;
        this.parser = parser;
    }

    async getPost(postId: number, forUserId: number): Promise<PostRawWithUserData | undefined> {
        return await this.postRepository.getPostWithUserData(postId, forUserId);
    }

    async createPost(siteName: string, userId: number, title: string, content: string, format: ContentFormat): Promise<PostEntity> {
        const site = await this.siteManager.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const html = this.parser.parse(content);
        const postRaw = await this.postRepository.createPost(site.id, userId, title, content, html);

        await this.bookmarkRepository.setWatch(postRaw.post_id, userId, true);

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
            bookmark: true
        };
    }

    async getPostComments(postId: number, forUserId: number): Promise<CommentRawWithUserData[]> {
        return await this.commentRepository.getPostComments(postId, forUserId);
    }

    async createComment(userId: number, postId: number, parentCommentId: number | undefined, content: string, format: ContentFormat): Promise<CommentEntity> {
        const html = this.parser.parse(content);

        const commentRaw = await this.commentRepository.createComment(userId, postId, parentCommentId, content, html);

        await this.bookmarkRepository.setWatch(postId, userId, true);

        // fan out in background
        this.feedManager.postFanOut(commentRaw.post_id).then().catch();

        return {
            id: commentRaw.comment_id,
            created: commentRaw.created_at,
            author: commentRaw.author_id,
            content: format === 'html' ? commentRaw.html : commentRaw.source,
            rating: commentRaw.rating,
            parentComment: commentRaw.parent_comment_id,
            isNew: true
        };
    }

    async setRead(postId: number, userId: number, readComments: number, lastCommentId?: number): Promise<boolean> {
        return await this.bookmarkRepository.setRead(postId, userId, readComments, lastCommentId);
    }

    async getBookmark(postId: number, userId: number): Promise<BookmarkRaw | undefined> {
        return await this.bookmarkRepository.getBookmark(postId, userId);
    }

    async setBookmark(postId: number, userId: number, bookmarked: boolean) {
        return await this.bookmarkRepository.setBookmark(postId, userId, bookmarked);
    }
}
