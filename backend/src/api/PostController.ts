import {Router} from 'express';
import PostManager, {PostRawWithUserData} from '../db/managers/PostManager';
import {User} from '../types/User';
import UserManager from '../db/managers/UserManager';
import SiteManager from '../db/managers/SiteManager';
import {Site} from '../types/Site';
import TheParser from '../parser/TheParser';
import {Logger} from 'winston';
import Joi from 'joi';
import {APIRequest, APIResponse, joiFormat, validate} from './ApiMiddleware';
import {ContentFormat} from '../types/common';

interface FeedRequest {
    site: string;
    page?: number;
    perpage?: number;
    format?: ContentFormat;
}
interface PostItem {
    id: number;
    site: string;
    author: number;
    created: Date;
    title?: string;
    content?: string;
    rating: number;
    comments: number;
    newComments: number;
    bookmark: boolean;
    vote?: number;
}
interface FeedResponse {
    posts: PostItem[];
    total: number;
    users: Record<number, User>;
    site: Site;
}

interface PostGetRequest {
    id: number;
    format?: ContentFormat;
}
interface PostGetResponse {
    post: PostItem;
    site: Site;
    comments: CommentItem[];
    users: Record<number, User>;
}


interface CreateRequest {
    site: string;
    title: string;
    content: string;
    format?: ContentFormat;
}
interface CreateResponse {
    post: PostItem;
}

interface CommentRequest {
    comment_id?: number;
    post_id: number;
    content: string;
    format?: ContentFormat;
}
interface CommentResponse {
    comment: CommentItem;
    users: Record<number, User>;
}

interface CommentItem {
    id: number;
    created: Date;
    author: number;
    deleted?: boolean;
    content: string;
    rating: number;
    parentComment?: number;

    isNew?: boolean;
    vote?: number;
    answers?: CommentItem[];
}

type PostReadRequest = {
    post_id: number;
    comments: number;
    last_comment_id?: number;
};
type PostReadResponse = Record<string, unknown>;

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
    private userManager: UserManager;
    private siteManager: SiteManager;
    private parser: TheParser;
    private logger: Logger;

    constructor(postManager: PostManager, siteManager: SiteManager, userManager: UserManager, parser: TheParser, logger: Logger) {
        this.postManager = postManager;
        this.userManager = userManager;
        this.siteManager = siteManager;
        this.parser = parser;
        this.logger = logger;

        const getSchema = Joi.object<PostGetRequest>({
            id: Joi.number().required(),
            format: joiFormat
        });
        const feedSchema = Joi.object<FeedRequest>({
            site: Joi.string().required(),
            page: Joi.number().default(1),
            perpage: Joi.number().min(1).max(50).default(10),
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
        this.router.post('/post/feed', validate(feedSchema), (req, res) => this.feed(req, res));
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
            const rawPost = <PostRawWithUserData>await this.postManager.getRaw(postId, userId);
            if (!rawPost) {
                return response.error('no-post', 'Post not found');
            }

            const site = await this.siteManager.getSiteById(rawPost.site_id);
            if (!site) {
                return response.error('error', 'Unknown error', 500);
            }

            const rawBookmark = await this.postManager.getBookmark(postId, userId);
            const lastReadCommentId = rawBookmark?.last_comment_id ?? 0;

            const rawComments = await this.postManager.getAllCommentsRaw(postId, userId);

            const post: PostItem = {
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
            users[rawPost.author_id] = await this.userManager.get(rawPost.author_id);

            const comments: CommentItem[] = [];
            const tmpComments: Record<number, CommentItem> = {};
            for (const rawComment of rawComments) {
                const comment: CommentItem = {
                    id: rawComment.comment_id,
                    created: rawComment.created_at,
                    author: rawComment.author_id,
                    content: format === 'html' ? rawComment.html : rawComment.source,
                    rating: rawComment.rating,
                    vote: rawComment.vote,
                    isNew: rawComment.author_id !== userId && rawComment.comment_id > lastReadCommentId
                };

                if (!users[rawComment.author_id]) {
                    users[rawComment.author_id] = await this.userManager.get(rawComment.author_id);
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
        const { site: subdomain, format, content, title } = request.body;

        try {
            const site = await this.siteManager.getSiteByName(subdomain);

            if (!site) {
                return response.error('no-site', 'Site not found');
            }

            const html = this.parser.parse(content);

            const post = await this.postManager.createPost(site.id, userId, title, content, html);

            this.logger.info(`Post created by #${userId}`, { user_id: userId, site: subdomain, format, content, title });

            response.success({
                post: {
                    id: post.post_id,
                    site: site.site,
                    author: post.author_id,
                    created: post.created_at,
                    title: post.title,
                    content: format === 'html' ? post.html : post.source,
                    rating: post.rating,
                    comments: post.comments,
                    newComments: 0,
                    vote: 0,
                    bookmark: true
                }
            });
        }
        catch (err) {
            this.logger.error('Post create failed', { error: err, user_id: userId, site: subdomain, format, content, title });
            return response.error('error', 'Unknown error', 500);
        }
    }

    async feed(request: APIRequest<FeedRequest>, response: APIResponse<FeedResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { site: subdomain, format, page, perpage: perPage } = request.body;

        try {
            const site = await this.siteManager.getSiteByName(subdomain);
            if (!site) {
                return response.error('no-site', 'Site not found');
            }

            const siteId = site.id;
            const total = await this.postManager.getTotal(siteId);

            const rawPosts = await this.postManager.getAllRaw(siteId, userId, page, perPage);

            const users: Record<number, User> = {};
            const posts: PostItem[] = [];
            for (const post of rawPosts) {
                if (!users[post.author_id]) {
                    users[post.author_id] = await this.userManager.get(post.author_id);
                }

                posts.push({
                    id: post.post_id,
                    site: site.site,
                    author: post.author_id,
                    created: post.created_at,
                    title: post.title,
                    content: format === 'html' ? post.html : post.source,
                    rating: post.rating,
                    comments: post.comments,
                    newComments: post.read_comments ? Math.max(0, post.comments - post.read_comments) : post.comments,
                    bookmark: post.bookmark > 1,
                    vote: post.vote
                });
            }

            response.success({
                posts: posts,
                total: total,
                users: users,
                site: site
            });
        }
        catch (err) {
            this.logger.error('Feed failed', { error: err, user_id: userId, site: subdomain, format });
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
            const html = this.parser.parse(content);

            const users: Record<number, User> = {};
            users[userId] = await this.userManager.get(userId);

            const commentRaw = await this.postManager.createComment(userId, postId, parentCommentId, content, html);

            this.logger.info(`Comment created by #${userId} @${users[userId].username}`, {
                comment: content,
                username: users[userId].username,
                user_id: userId
            });

            response.success({
                comment: {
                    id: commentRaw.comment_id,
                    created: commentRaw.created_at,
                    author: commentRaw.author_id,
                    content: format === 'html' ? commentRaw.html : commentRaw.source,
                    rating: commentRaw.rating,
                    parentComment: commentRaw.parent_comment_id,
                    isNew: true
                },
                users: users
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

        // update in background
        this.postManager.setRead(postId, userId, comments, lastCommentId)
            .then()
            .catch(err => {
                this.logger.error(`Read update failed`, { error: err, user_id: userId, post_id: postId, comments: comments, last_comment_id: lastCommentId });
            })

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
