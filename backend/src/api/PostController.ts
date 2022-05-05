import {Router} from 'express';
import PostManager from '../managers/PostManager';
import UserManager from '../managers/UserManager';
import SiteManager from '../managers/SiteManager';
import {Logger} from 'winston';
import Joi from 'joi';
import {APIRequest, APIResponse, joiFormat, validate} from './ApiMiddleware';
import FeedManager from '../managers/FeedManager';
import {PostEntity} from './types/entities/PostEntity';
import {CommentEntity} from './types/entities/CommentEntity';
import {PostGetRequest, PostGetResponse} from './types/requests/PostGet';
import {PostCreateRequest, PostCreateResponse} from './types/requests/PostCreate';
import {PostReadRequest, PostReadResponse} from './types/requests/PostRead';
import {PostBookmarkRequest, PostBookmarkResponse} from './types/requests/PostBookmark';
import {PostCommentRequest, PostCommentResponse} from './types/requests/PostComment';
import {UserEntity} from './types/entities/UserEntity';
import {PostWatchRequest, PostWatchResponse} from './types/requests/PostWatch';

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

            const rawComments = await this.postManager.getPostComments(postId, userId);

            const post: PostEntity = {
                id: rawPost.post_id,
                site: site.site,
                author: rawPost.author_id,
                created: rawPost.created_at.toISOString(),
                title: rawPost.title,
                content: format === 'html' ? rawPost.html : rawPost.source,
                rating: rawPost.rating,
                comments: rawPost.comments,
                newComments: 0,
                vote: rawPost.vote,
                bookmark: !!rawPost.bookmark,
                watch: !!rawPost.watch
            };

            const users: Record<number, UserEntity> = {};
            users[rawPost.author_id] = await this.userManager.getById(rawPost.author_id);

            const comments: CommentEntity[] = [];
            const tmpComments: Record<number, CommentEntity> = {};
            for (const rawComment of rawComments) {
                const comment: CommentEntity = {
                    id: rawComment.comment_id,
                    created: rawComment.created_at.toISOString(),
                    author: rawComment.author_id,
                    content: format === 'html' ? rawComment.html : rawComment.source,
                    rating: rawComment.rating,
                    vote: rawComment.vote,
                    isNew: rawComment.author_id !== userId && rawComment.comment_id > rawPost.last_read_comment_id
                };

                if (!users[rawComment.author_id]) {
                    users[rawComment.author_id] = await this.userManager.getById(rawComment.author_id);
                }
                tmpComments[rawComment.comment_id] = comment;

                if (!rawComment.parent_comment_id) {
                    comments.push(comment);
                }
                else {
                    const parentComment = tmpComments[rawComment.parent_comment_id];
                    if (parentComment) {
                        if (!parentComment.answers) {
                            parentComment.answers = [];
                        }

                        parentComment.answers.push(comment);
                    }
                }
            }

            response.success({
                post: post,
                site: site,
                comments: comments,
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

    async comment(request: APIRequest<PostCommentRequest>, response: APIResponse<PostCommentResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { post_id: postId, comment_id: parentCommentId, format, content } = request.body;

        try {
            const users: Record<number, UserEntity> = {};
            users[userId] = await this.userManager.getById(userId);

            const comment = await this.postManager.createComment(userId, postId, parentCommentId, content, format);

            this.logger.info(`Comment created by #${userId} @${users[userId].username}`, {
                comment: content,
                username: users[userId].username,
                user_id: userId
            });

            response.success({
                comment,
                users
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
