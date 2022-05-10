import {Router} from 'express';
import PostManager from '../managers/PostManager';
import UserManager from '../managers/UserManager';
import SiteManager from '../managers/SiteManager';
import {Logger} from 'winston';
import Joi from 'joi';
import {APIRequest, APIResponse, joiFormat, validate} from './ApiMiddleware';
import FeedManager from '../managers/FeedManager';
import {PostGetRequest, PostGetResponse} from './types/requests/PostGet';
import {PostCreateRequest, PostCreateResponse} from './types/requests/PostCreate';
import {PostReadRequest, PostReadResponse} from './types/requests/PostRead';
import {PostBookmarkRequest, PostBookmarkResponse} from './types/requests/PostBookmark';
import {PostCommentRequest, PostCommentResponse} from './types/requests/PostComment';
import {UserEntity} from './types/entities/UserEntity';
import {PostWatchRequest, PostWatchResponse} from './types/requests/PostWatch';
import {PostPreviewRequest, PostPreviewResponse} from './types/requests/Preview';
import {SiteEntity} from "./types/entities/SiteEntity";

export default class PostController {
    public router = Router();
    private postManager: PostManager;
    private feedManager: FeedManager;
    private userManager: UserManager;
    private siteManager: SiteManager;
    private logger: Logger;

    constructor(postManager: PostManager, feedManager: FeedManager, siteManager: SiteManager, userManager: UserManager, logger: Logger) {
        this.postManager = postManager;
        this.userManager = userManager;
        this.siteManager = siteManager;
        this.feedManager = feedManager;
        this.logger = logger;

        const getSchema = Joi.object<PostGetRequest>({
            id: Joi.number().required(),
            format: joiFormat
        });
        const readSchema = Joi.object<PostReadRequest>({
            post_id: Joi.number().required(),
            comments: Joi.number().required(),
            last_comment_id: Joi.number().optional()
        });
        const postCreateSchema = Joi.object<PostCreateRequest>({
            site: Joi.string().required(),
            title: Joi.alternatives(Joi.string().max(50), Joi.valid('').optional()),
            content: Joi.string().min(1).max(50000).required(),
            format: joiFormat
        });
        const commentSchema = Joi.object<PostCommentRequest>({
            comment_id: Joi.number().optional(),
            post_id: Joi.number().required(),
            content: Joi.string().min(1).max(50000).required(),
            format: joiFormat
        });
        const previewSchema = Joi.object<PostPreviewRequest>({
            content: Joi.string().min(1).max(50000).required(),
        });
        const bookmarkSchema = Joi.object<PostBookmarkRequest>({
            post_id: Joi.number().required(),
            bookmark: Joi.boolean().required()
        });
        const watchingSchema = Joi.object<PostWatchRequest>({
            post_id: Joi.number().required(),
            watch: Joi.boolean().required()
        });

        this.router.post('/post/get', validate(getSchema), (req, res) => this.postGet(req, res));
        this.router.post('/post/create', validate(postCreateSchema), (req, res) => this.create(req, res));
        this.router.post('/post/comment', validate(commentSchema), (req, res) => this.comment(req, res));
        this.router.post('/post/preview', validate(previewSchema), (req, res) => this.preview(req, res));
        this.router.post('/post/read', validate(readSchema), (req, res) => this.read(req, res));
        this.router.post('/post/bookmark', validate(bookmarkSchema), (req, res) => this.bookmark(req, res));
        this.router.post('/post/watch', validate(watchingSchema), (req, res) => this.watch(req, res));
    }

    async postGet(request: APIRequest<PostGetRequest>, response: APIResponse<PostGetResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id: postId, format } = request.body;

        try {
            const rawPost = await this.postManager.getPost(postId, userId);
            if (!rawPost) {
                return response.error('no-post', 'Post not found');
            }

            const site = await this.siteManager.getSiteById(rawPost.site_id);
            if (!site) {
                return response.error('error', 'Unknown error', 500);
            }

            const { posts : [post], users  } = await this.postManager.enrichRawPosts([rawPost], format);
            const rawComments = await this.postManager.getPostComments(postId, userId);
            const {rootComments} = await this.postManager.enrichRawComments(rawComments, users, format,
                (comment) => comment.author_id !== userId && comment.comment_id > rawPost.last_read_comment_id
            );

            response.success({
                post: post,
                site: site,
                comments: rootComments,
                users: users
            });
        }
        catch (err) {
            this.logger.error('Post get error', { error: err, post_id: postId });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async create(request: APIRequest<PostCreateRequest>, response: APIResponse<PostCreateResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site, format, content, title } = request.body;

        try {
            const post = await this.postManager.createPost(site, userId, title, content, format);
            this.logger.info(`Post created by #${userId}`, { user_id: userId, site, format, content, title });
            response.success({ post });
        }
        catch (err) {
            this.logger.error('Post create failed', { error: err, user_id: userId, site, format, content, title });
            return response.error('error', 'Unknown error', 500);
        }
    }

    preview(request: APIRequest<PostPreviewRequest>, response: APIResponse<PostPreviewResponse>) {
        const userId = request.session.data.userId;
        if (!userId) {
            return response.authRequired();
        }
        const content = request.body.content;
        try {
            const result =  this.postManager.preview(content);
            response.success({ content : result });
        } catch (err) {
            this.logger.error('Comment create failed', { error: err, user_id: userId, content });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async comment(request: APIRequest<PostCommentRequest>, response: APIResponse<PostCommentResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { post_id: postId, comment_id: parentCommentId, format, content } = request.body;

        try {
            const users: Record<number, UserEntity> = {[userId]: await this.userManager.getById(userId)};
            const comment = await this.postManager.createComment(userId, postId, parentCommentId, content, format);

            const sites: Record<number, SiteEntity> = {[userId]: await this.siteManager.getSiteById(comment.site_id)};

            this.logger.info(`Comment created by #${userId} @${users[userId].username}`, {
                comment: content,
                username: users[userId].username,
                user_id: userId
            });

            response.success({
                comment,
                users,
                sites
            });
        }
        catch (err) {
            this.logger.error('Comment create failed', { error: err, user_id: userId, format, content, post_id: postId });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async read(request: APIRequest<PostReadRequest>, response: APIResponse<PostReadResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { post_id: postId, comments, last_comment_id: lastCommentId } = request.body;

        const readUpdated = await this.postManager.setRead(postId, userId, comments, lastCommentId);
            // update in background
            // .then()
            // .catch(err => {
            //     this.logger.error(`Read update failed`, { error: err, user_id: userId, post_id: postId, comments: comments, last_comment_id: lastCommentId });
            // });

        if (readUpdated) {
            const status = await this.userManager.getUserStats(userId);
            return response.success({
                notifications: status.notifications,
                watch: status.watch
            });
        }

        response.success({});
    }

    async bookmark(request: APIRequest<PostBookmarkRequest>, response: APIResponse<PostBookmarkResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { post_id: postId, bookmark } = request.body;

        try {
            await this.postManager.setBookmark(postId, userId, bookmark);
            response.success({bookmark: bookmark});
        }
        catch (err) {
            this.logger.error('Bookmark failed', { error: err, user_id: userId, post_id: postId, bookmark });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async watch(request: APIRequest<PostWatchRequest>, response: APIResponse<PostWatchResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { post_id: postId, watch } = request.body;

        try {
            await this.postManager.setWatch(postId, userId, watch);
            response.success({watch});
        }
        catch (err) {
            this.logger.error('Watch failed', { error: err, user_id: userId, post_id: postId, watch });
            return response.error('error', 'Unknown error', 500);
        }
    }
}
