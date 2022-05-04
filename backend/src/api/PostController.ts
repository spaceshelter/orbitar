import {Router} from 'express';
import PostManager from '../db/managers/PostManager';
import {User} from '../types/User';
import UserManager from '../db/managers/UserManager';
import SiteManager from '../db/managers/SiteManager';
import {Site} from '../types/Site';
import {Logger} from 'winston';
import Joi from 'joi';
import {APIRequest, APIResponse, joiFormat, validate} from './ApiMiddleware';
import {ContentFormat} from '../types/common';
import FeedManager from '../db/managers/FeedManager';
import {PostEntity} from './entities/PostEntity';
import {CommentEntity} from './entities/CommentEntity';

interface PostGetRequest {
    id: number;
    format?: ContentFormat;
}
interface PostGetResponse {
    post: PostEntity;
    site: Site;
    comments: CommentEntity[];
    users: Record<number, User>;
}


interface CreateRequest {
    site: string;
    title: string;
    content: string;
    format?: ContentFormat;
}
interface CreateResponse {
    post: PostEntity;
}

interface CommentRequest {
    comment_id?: number;
    post_id: number;
    content: string;
    format?: ContentFormat;
}
interface CommentResponse {
    comment: CommentEntity;
    users: Record<number, User>;
}

type PostReadRequest = {
    post_id: number;
    comments: number;
    last_comment_id?: number;
};
type PostReadResponse = {
    watch?: {
        posts: number;
        comments: number;
    };
};

interface BookmarkRequest {
    post_id: number;
    bookmark: boolean;
}
interface BookmarkResponse {
    bookmark: boolean;
}

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
        const bookmarkSchema = Joi.object<BookmarkRequest>({
            post_id: Joi.number().required(),
            bookmark: Joi.boolean().required()
        });
        const postCreateSchema = Joi.object<CreateRequest>({
            site: Joi.string().required(),
            title: Joi.alternatives(Joi.string().max(50), Joi.valid('').optional()),
            content: Joi.string().min(1).max(50000).required(),
            format: joiFormat
        });
        const commentSchema = Joi.object<CommentRequest>({
            comment_id: Joi.number().optional(),
            post_id: Joi.number().required(),
            content: Joi.string().min(1).max(50000).required(),
            format: joiFormat
        });

        this.router.post('/post/get', validate(getSchema), (req, res) => this.postGet(req, res));
        this.router.post('/post/create', validate(postCreateSchema), (req, res) => this.create(req, res));
        this.router.post('/post/comment', validate(commentSchema), (req, res) => this.comment(req, res));
        this.router.post('/post/read', validate(readSchema), (req, res) => this.read(req, res));
        this.router.post('/post/bookmark', validate(bookmarkSchema), (req, res) => this.bookmark(req, res));
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

            const rawBookmark = await this.postManager.getBookmark(postId, userId);
            const lastReadCommentId = rawBookmark?.last_comment_id ?? 0;

            const rawComments = await this.postManager.getPostComments(postId, userId);

            const post: PostEntity = {
                id: rawPost.post_id,
                site: site.site,
                author: rawPost.author_id,
                created: rawPost.created_at,
                title: rawPost.title,
                content: format === 'html' ? rawPost.html : rawPost.source,
                rating: rawPost.rating,
                comments: rawPost.comments,
                newComments: 0,
                vote: rawPost.vote,
                bookmark: false
            };

            const users: Record<number, User> = {};
            users[rawPost.author_id] = await this.userManager.getById(rawPost.author_id);

            const comments: CommentEntity[] = [];
            const tmpComments: Record<number, CommentEntity> = {};
            for (const rawComment of rawComments) {
                const comment: CommentEntity = {
                    id: rawComment.comment_id,
                    created: rawComment.created_at,
                    author: rawComment.author_id,
                    content: format === 'html' ? rawComment.html : rawComment.source,
                    rating: rawComment.rating,
                    vote: rawComment.vote,
                    isNew: rawComment.author_id !== userId && rawComment.comment_id > lastReadCommentId
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

    async create(request: APIRequest<CreateRequest>, response: APIResponse<CreateResponse>) {
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

    async comment(request: APIRequest<CommentRequest>, response: APIResponse<CommentResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { post_id: postId, comment_id: parentCommentId, format, content } = request.body;

        try {
            const users: Record<number, User> = {};
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

    async bookmark(request: APIRequest<BookmarkRequest>, response: APIResponse<BookmarkResponse>) {
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
}
