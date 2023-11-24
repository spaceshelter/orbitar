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
import {Enricher} from './utils/Enricher';
import {PostGetCommentRequest, PostGetCommentResponse} from './types/requests/PostGetComment';
import {PostCommentEditRequest, PostCommentEditResponse} from './types/requests/PostEditComment';
import CodeError from '../CodeError';
import {CommentEntity} from './types/entities/CommentEntity';
import {PostEditRequest, PostEditResponse} from './types/requests/PostEdit';
import {PostHistoryRequest, PostHistoryResponse} from './types/requests/PostHistory';
import {HistoryEntity} from './types/entities/HistoryEntity';
import rateLimit from 'express-rate-limit';
import {TranslateRequest, TranslateResponse} from './types/requests/Translate';
import TranslationManager, {TRANSLATION_MODES} from '../managers/TranslationManager';
import {APIError, AuthenticationError, RateLimitError} from 'openai';
import {
    GetPublicKeyByPostOrCommentRequest,
    GetPublicKeyByPostOrCommentResponse
} from './types/requests/GetPublicKeyByPostOrComment';

const commonRateLimitConfig = {
    skipSuccessfulRequests: false,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.session.data?.userId)
};

export default class PostController {
    public readonly router = Router();
    private readonly postManager: PostManager;
    private readonly feedManager: FeedManager;
    private readonly userManager: UserManager;
    private readonly siteManager: SiteManager;
    private readonly translationManager: TranslationManager;
    private readonly logger: Logger;
    private readonly enricher: Enricher;

    // 5 per hour
    private readonly postCreateRateLimiter = rateLimit({
        max: 5,
        windowMs: 3600 * 1000,
        ...commonRateLimitConfig
    });

    /* 40/(30 mins) */
    private readonly postEditRateLimiter = rateLimit({
        max: 40,
        windowMs: 30 * 60 * 1000,
        ...commonRateLimitConfig
    });

    /* 40/(30 mins) */
    private readonly commentRateLimiter = rateLimit({
        max: 40,
        windowMs: 30 * 60 * 1000,
        ...commonRateLimitConfig
    });

    constructor(enricher: Enricher, postManager: PostManager, feedManager: FeedManager, siteManager: SiteManager,
                userManager: UserManager, translationManager: TranslationManager, logger: Logger) {
        this.enricher = enricher;
        this.postManager = postManager;
        this.userManager = userManager;
        this.siteManager = siteManager;
        this.feedManager = feedManager;
        this.translationManager = translationManager;
        this.logger = logger;

        const getSchema = Joi.object<PostGetRequest>({
            id: Joi.number().required(),
            format: joiFormat,
            noComments: Joi.boolean().default(false)
        });
        const readSchema = Joi.object<PostReadRequest>({
            post_id: Joi.number().required(),
            comments: Joi.number().required(),
            last_comment_id: Joi.number().optional()
        });
        const postCreateSchema = Joi.object<PostCreateRequest>({
            site: Joi.string().required(),
            title: Joi.alternatives(Joi.string().max(64), Joi.valid('').optional()),
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
        const getCommentSchema = Joi.object<PostGetCommentRequest>({
            id: Joi.number().required(),
            format: joiFormat
        });
        const editCommentSchema = Joi.object<PostCommentEditRequest>({
            id: Joi.number().required(),
            content: Joi.string().min(1).max(50000).required(),
            format: joiFormat
        });
        const editSchema = Joi.object<PostEditRequest>({
            id: Joi.number().required(),
            title: Joi.alternatives(Joi.string().max(64), Joi.valid('').optional()),
            content: Joi.string().min(1).max(50000).required(),
            format: joiFormat
        });
        const translateSchema = Joi.object<TranslateRequest>({
            id: Joi.number().required(),
            type: Joi.string().valid('post', 'comment').required(),
            mode: Joi.string().valid(...TRANSLATION_MODES).required(),
        });
        const historySchema = Joi.object<PostHistoryRequest>({
            id: Joi.number().required(),
            type: Joi.valid('post', 'comment').required(),
            format: joiFormat
        });
        const getPostPublicKeySchema = Joi.object<GetPublicKeyByPostOrCommentRequest>({
            postId: Joi.number().optional(),
            commentId: Joi.number().optional(),
        });

        this.router.post('/post/get', validate(getSchema), (req, res) => this.postGet(req, res));
        this.router.post('/post/create', this.postCreateRateLimiter, validate(postCreateSchema), (req, res) => this.create(req, res));
        this.router.post('/post/edit', this.postEditRateLimiter, validate(editSchema), (req, res) => this.postEdit(req, res));
        this.router.post('/post/comment', this.commentRateLimiter, validate(commentSchema), (req, res) => this.comment(req, res));
        this.router.post('/post/preview', validate(previewSchema), (req, res) => this.preview(req, res));
        this.router.post('/post/read', validate(readSchema), (req, res) => this.read(req, res));
        this.router.post('/post/bookmark', validate(bookmarkSchema), (req, res) => this.bookmark(req, res));
        this.router.post('/post/watch', validate(watchingSchema), (req, res) => this.watch(req, res));
        this.router.post('/post/translate', validate(translateSchema), (req, res) => this.translate(req, res));
        this.router.post('/post/get-comment', validate(getCommentSchema), (req, res) => this.getComment(req, res));
        this.router.post('/post/edit-comment', this.commentRateLimiter, validate(editCommentSchema), (req, res) => this.editComment(req, res));
        this.router.post('/post/history', validate(historySchema), (req, res) => this.history(req, res));
        this.router.post('/post/get-public-key', validate(getPostPublicKeySchema), (req, res) =>
            this.getPublicKeyByPostOrComment(req, res));
    }

    async postGet(request: APIRequest<PostGetRequest>, response: APIResponse<PostGetResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id: postId, format, noComments } = request.body;

        try {
            const rawPost = await this.postManager.getPost(postId, userId, format);
            if (!rawPost) {
                return response.error('no-post', 'Post not found');
            }

            const site = await this.siteManager.getSiteByNameWithUserInfo(userId, rawPost.site);
            if (!site) {
                return response.error('error', 'Unknown error', 500);
            }

            const restrictions = await this.userManager.getUserRestrictions(userId);
            if (restrictions.restrictedToPostId !== false && rawPost.author !== userId) {
                return response.error('access-denied', 'You don\'t have permission to view this post', 403);
            }

            const {posts: [post], users} = await this.enricher.enrichRawPosts([rawPost]);
            if (!restrictions.canEditOwnContent) {
                post.canEdit = false;
            }

            let comments: CommentEntity[] = [];
            if (!noComments) {
                const rawComments = await this.postManager.getPostComments(postId, userId, format);

                if (!restrictions.canEditOwnContent) {
                    rawComments.forEach(comment => comment.canEdit = false);
                }

                const {rootComments} = await this.enricher.enrichRawComments(rawComments, users, format,
                    (comment) => comment.author !== userId && comment.id > rawPost.lastReadCommentId
                );
                comments = rootComments;
            }

            const userIdOverride = await this.postManager.getUserIdOverride(postId);
            const userIdOverrideEntity = userIdOverride && await this.userManager.getById(userIdOverride);

            response.success({
                post: post,
                site: this.enricher.siteInfoToEntity(site),
                comments: comments,
                users: users,
                anonymousUser: userIdOverrideEntity
            });
        }
        catch (err) {
            this.logger.error('Post get error', { error: err, post_id: postId });
            this.logger.error(err);
            return response.error('error', 'Unknown error', 500);
        }
    }

    async postEdit(request: APIRequest<PostEditRequest>, response: APIResponse<PostEditResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id, title, format, content } = request.body;

        try {
            const restrictions = await this.userManager.getUserRestrictions(userId);
            if (!restrictions.canEditOwnContent) {
                return response.error('access-denied', 'Access-denied', 403);
            }

            const postInfo = await this.postManager.editPost(userId, id, title, content, format);
            if (!postInfo) {
                return response.error('no-comment', 'Post not found');
            }

            const {posts: [post], users} = await this.enricher.enrichRawPosts([postInfo]);

            this.logger.info(`Post edited by #${userId}`, { user_id: userId, post_id: id, format, content, title });
            response.success({ post, users });
        }
        catch (err) {
            this.logger.error('Post edit error', { error: err, user_id: userId, post_id: id, format, content, title });
            this.logger.error(err);

            if (err instanceof CodeError && err.code === 'access-denied') {
                return response.error('access-denied', 'Access-denied');
            }

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
            const userRestrictions = await this.userManager.getUserRestrictions(userId);
            if (userRestrictions.postSlowModeWaitSecRemain !== 0) {
                return response.error('slow-mode', `Slow mode is enabled. Time left ${userRestrictions.postSlowModeWaitSecRemain} seconds.`, 403);
            }
            if (userRestrictions.restrictedToPostId && userRestrictions.restrictedToPostId !== true) {
                return response.error('post-creation-restricted', 'You cannot create any more posts due to low karma.', 403);
            }

            const postInfo = await this.postManager.createPost(site, userId, title, content, format);
            const {posts: [post]} = await this.enricher.enrichRawPosts([postInfo]);

            this.logger.info(`Post created by #${userId}`, { user_id: userId, site, format, content, title });
            response.success({ post });
        }
        catch (err) {
            this.logger.error('Post create failed', { error: err, user_id: userId, site, format, content, title });
            this.logger.error(err);
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
            const result = this.postManager.preview(content);
            response.success({ content : result });
        } catch (err) {
            this.logger.error('Comment create failed', { error: err, user_id: userId, content });
            this.logger.error(err);
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
            const userRestrictions = await this.userManager.getUserRestrictions(userId);
            if (userRestrictions.commentSlowModeWaitSecRemain > 0) {
                return response.error('slow-mode', `Slow mode, time left ${userRestrictions.commentSlowModeWaitSecRemain} sec`, 403);
            }
            if (userRestrictions.restrictedToPostId && postId !== userRestrictions.restrictedToPostId) {
                const rid = userRestrictions.restrictedToPostId;
                return response.error('restricted', `Commenting restricted ${rid === true ? 'to own posts' : `to post #${rid}`}`, 403);
            }

            const overrideUserId = (await this.postManager.getUserIdOverride(postId)) || userId;

            const doFanOutAndNotifications = userRestrictions.restrictedToPostId === false;
            const commentInfo = await this.postManager.createComment(
                overrideUserId, postId, parentCommentId, content, format, doFanOutAndNotifications
            );
            const { allComments : [comment] } = await this.enricher.enrichRawComments([commentInfo], {}, format, () => true);
            comment.canEdit = overrideUserId === userId;

            const users: Record<number, UserEntity> = {[overrideUserId]: await this.userManager.getById(overrideUserId)};

            this.logger.info(`Comment created by #${overrideUserId} @${users[overrideUserId].username}`, {
                comment: content,
                username: users[overrideUserId].username,
                user_id: overrideUserId
            });

            response.success({
                comment,
                users
            });
        }
        catch (err) {
            this.logger.error('Comment create failed', { error: err, user_id: userId, format, content, post_id: postId });
            this.logger.error(err);
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

        if (readUpdated) {
            this.userManager.deleteUserStatsCache(userId);
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
            this.logger.error(err);
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
            this.userManager.deleteUserStatsCache(userId);
            response.success({watch});
        }
        catch (err) {
            this.logger.error('Watch failed', { error: err, user_id: userId, post_id: postId, watch });
            this.logger.error(err);
            return response.error('error', 'Unknown error', 500);
        }
    }

    async getComment(request: APIRequest<PostGetCommentRequest>, response: APIResponse<PostGetCommentResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id: commentId, format } = request.body;

        try {
            const commentInfo = await this.postManager.getComment(userId, commentId, format);
            if (!commentInfo) {
                return response.error('no-comment', 'Comment not found');
            }

            const restrictions = await this.userManager.getUserRestrictions(userId);
            if (restrictions.restrictedToPostId && restrictions.restrictedToPostId !== commentInfo.post) {
                // simplification, but currently getComment is used only for editing, so it's ok
                return response.error('access-denied', `Commenting restricted to post #${restrictions.restrictedToPostId}`, 403);
            }

            const {allComments: [comment], users} = await this.enricher.enrichRawComments([commentInfo], {}, format,
                () => false
            );

            response.success({
                comment: comment,
                users: users
            });
        }
        catch (err) {
            this.logger.error('Comment get error', { error: err, comment_id: commentId });
            this.logger.error(err);
            return response.error('error', 'Unknown error', 500);
        }
    }

    async editComment(request: APIRequest<PostCommentEditRequest>, response: APIResponse<PostCommentEditResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id: commentId, content, format } = request.body;

        try {
            const userRestrictions = await this.userManager.getUserRestrictions(userId);
            if (!userRestrictions.canEditOwnContent) {
                return response.error('restricted', 'Editing restricted', 403);
            }

            const commentInfo = await this.postManager.editComment(userId, commentId, content, format);
            if (!commentInfo) {
                return response.error('no-comment', 'Comment not found');
            }

            const {allComments: [comment], users} = await this.enricher.enrichRawComments([commentInfo], {}, format,
                () => false
            );

            response.success({
                comment: comment,
                users: users
            });
        }
        catch (err) {
            this.logger.error('Comment edit error', { error: err, comment_id: commentId });
            this.logger.error(err);

            if (err instanceof CodeError && err.code === 'access-denied') {
                return response.error('access-denied', 'Access-denied');
            }

            return response.error('error', 'Unknown error', 500);
        }
    }

    async translate(request: APIRequest<TranslateRequest>, response: APIResponse<TranslateResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }
        const {id, type, mode} = request.body;
        try {
            const restrictions = await this.userManager.getUserRestrictions(request.session.data.userId);
            if (restrictions.restrictedToPostId !== false) {
                // simplification, just disallows the translation
                return response.error('access-denied', `Translation is not allowed.`, 403);
            }

            await this.translationManager.translateEntity(id, type, mode, (chunk) => response.write(chunk));
            response.end();
        } catch (err) {
            let msg = 'Unknown error';
            if(err instanceof AuthenticationError){
                msg = 'OpenAI AuthenticationError';
            } else if(err instanceof RateLimitError){
                msg = 'OpenAI RateLimitError';
            } else if(err instanceof APIError) {
                msg = 'OpenAI error';
            }
            this.logger.error(err);
            try {
                response.error('error', msg, 500);
            } catch (err) {
                // in case some chunks were already written
                // should not happen now, just a precaution if the invariant in translateEntity is broken
                this.logger.error('Error writing response');
                this.logger.error(err);
                try {
                    response.write('{"result":"error","code":"error"}');
                } finally {
                    response.end();
                }
            }
        }
    }

    async history(request: APIRequest<PostHistoryRequest>, response: APIResponse<PostHistoryResponse>) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        const { id, type, format } = request.body;

        try {
            const restrictions = await this.userManager.getUserRestrictions(userId);
            if (restrictions.restrictedToPostId !== false) {
                return response.error('access-denied', 'Access-denied', 403);
            }

            const historyInfos = await this.postManager.getHistory(userId, id, type, format);

            const history: HistoryEntity[] = historyInfos.map(h => ({
                id: h.id,
                title: h.title,
                comment: h.comment,
                content: h.content,
                date: h.date.toISOString(),
                editor: h.editor,
                changed: h.changed
            }));

            response.success({
                history,
            });
        }
        catch (err) {
            this.logger.error('History request error', { error: err, ref_id: id, ref_type: type });
            this.logger.error(err);

            if (err instanceof CodeError && err.code === 'access-denied') {
                return response.error('access-denied', 'Access-denied');
            }

            return response.error('error', 'Unknown error', 500);
        }
    }

    private async getPublicKeyByPostOrComment(req: APIRequest<GetPublicKeyByPostOrCommentRequest>, res: APIResponse<GetPublicKeyByPostOrCommentResponse>) {
        const {postId, commentId} = req.body;

        const userId = req.session.data.userId;

        let targetUserId: number | undefined;
        if (commentId) {
            targetUserId = (await this.postManager.getComment(userId, commentId, 'html'))?.author;
        } else if (postId) {
            // note: inconsistent param order between getPost and getComment
            // is not a mistake, it's just how it is (FIXME)
            targetUserId = (await this.postManager.getPost(postId, userId, 'html'))?.author;
        }

        if (!targetUserId) {
            return res.success({publicKey: undefined, username: undefined});
        } else {
            const publicKey = await this.userManager.getPublicKey(targetUserId);
            return res.success({
                publicKey,
                username: (await this.userManager.getById(targetUserId))?.username,
            });
        }
    }
}
