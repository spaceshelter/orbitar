import express from 'express';
import PostManager, {PostRawWithUserData} from '../db/managers/PostManager';
import {User} from '../types/User';
import UserManager from '../db/managers/UserManager';
import SiteManager from '../db/managers/SiteManager';
import {Site} from '../types/Site';
import sanitizeHtml from 'sanitize-html';

interface FeedRequest {
    site: string;
    page?: number;
    perpage?: number;
    format?: 'html' | 'source';
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
    format?: 'html' | 'source';
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
    format?: 'html' | 'source';
}
interface CreateResponse {
    post: PostItem;
}

interface CommentRequest {
    comment_id?: number;
    post_id: number;
    content: string;
    format?: 'html' | 'source';
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

interface ReadRequest {
    post_id: number;
    comments: number;
    last_comment_id?: number;
}
interface BookmarkRequest {
    post_id: number;
    bookmark: boolean;
}

export default class PostController {
    public router = express.Router();
    private postManager: PostManager;
    private userManager: UserManager;
    private siteManager: SiteManager;

    constructor(postManager: PostManager, siteManager: SiteManager, userManager: UserManager) {
        this.postManager = postManager;
        this.userManager = userManager;
        this.siteManager = siteManager;

        this.router.post('/post/get', (req, res) => this.postGet(req, res));
        this.router.post('/post/feed', (req, res) => this.feed(req, res));
        this.router.post('/post/create', (req, res) => this.create(req, res));
        this.router.post('/post/comment', (req, res) => this.comment(req, res));
        this.router.post('/post/read', (req, res) => this.read(req, res));
        this.router.post('/post/bookmark', (req, res) => this.bookmark(req, res));
    }

    async postGet(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        let userId = request.session.data.userId;

        let body = <PostGetRequest> request.body;
        let postId = body.id;
        let format = body.format || 'html';

        if (!postId) {
            return response.error('id-required', 'Post id required');
        }

        let rawPost = <PostRawWithUserData> await this.postManager.getRaw(postId, userId);
        if (!rawPost) {
            return response.error('no-post', 'Post not found');
        }

        let site = await this.siteManager.getSiteById(rawPost.site_id);
        if (!site) {
            return response.error('error', 'Unknown error', 500);
        }

        let rawBookmark = await this.postManager.getBookmark(postId, userId);
        let lastReadCommentId = rawBookmark?.last_comment_id ?? 0;

        let rawComments = await this.postManager.getAllCommentsRaw(postId, userId);

        let post = {
            id: rawPost.post_id,
            site: site.site,
            author: rawPost.author_id,
            created: rawPost.created_at,
            title: rawPost.title,
            content: format === 'html' ? rawPost.html : rawPost.source,
            rating: rawPost.rating,
            comments: rawPost.comments,
            newComments: 0,
            vote: rawPost.vote
        };

        let users: Record<number, User> = {};
        users[rawPost.author_id] = await this.userManager.get(rawPost.author_id);

        let comments: CommentItem[] = [];
        let tmpComments: Record<number, CommentItem> = {};
        for (let rawComment of rawComments) {
            let comment: CommentItem = {
                id: rawComment.comment_id,
                created: rawComment.created_at,
                author: rawComment.author_id,
                content: format === 'html' ? rawComment.html : rawComment.source,
                rating: rawComment.rating,
                vote: rawComment.vote,
                isNew: rawComment.comment_id > lastReadCommentId
            };

            if (!users[rawComment.author_id]) {
                users[rawComment.author_id] = await this.userManager.get(rawComment.author_id);
            }
            tmpComments[rawComment.comment_id] = comment;

            if (!rawComment.parent_comment_id) {
                comments.push(comment);
            }
            else {
                let parentComment = tmpComments[rawComment.parent_comment_id];
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
        } as PostGetResponse);
    }

    async create(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        let userId = request.session.data.userId;
        let body = <CreateRequest> request.body;
        let format = body.format || 'html';

        if (!body.content) {
            return response.error('content-required', 'Content required');
        }

        let subdomain = body.site;
        let site = await this.siteManager.getSiteByName(subdomain);

        if (!site) {
            return response.error('no-site', 'Site not found');
        }

        let html = this.parseContent(body.content);

        let post = await this.postManager.createPost(site.id, userId, body.title, body.content, html);

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
                vote: 0
            }
        } as CreateResponse);
    }

    async feed(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        let userId = request.session.data.userId;

        let body = <FeedRequest> request.body;

        let subdomain = body.site;

        let site = await this.siteManager.getSiteByName(subdomain);
        if (!site) {
            return response.error('no-site', 'Site not found');
        }

        let siteId = site.id;
        let page = body.page || 1;
        let format = body.format || 'html';
        let perPage = Math.min(Math.max(body.perpage || 10, 1), 50);

        let total = await this.postManager.getTotal(siteId);

        let rawPosts = await this.postManager.getAllRaw(siteId, userId, page, perPage);

        let users: Record<number, User> = {};
        let posts: PostItem[] = [];
        for (let post of rawPosts) {
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
        } as FeedResponse);
    }

    async comment(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        let userId = request.session.data.userId;
        let body = <CommentRequest> request.body;
        let postId = body.post_id;
        let parentCommentId = body.comment_id;
        let format = body.format || 'html';

        if (!body.content) {
            return response.error('content-required', 'Content required');
        }

        if (!postId) {
            return response.error('id-required', 'Post id required');
        }

        let rawPost = <PostRawWithUserData> await this.postManager.getRaw(postId, userId);
        if (!rawPost) {
            return response.error('no-post', 'Post not found');
        }

        let site = await this.siteManager.getSiteById(rawPost.site_id);
        if (!site) {
            return response.error('error', 'Unknown error', 500);
        }

        let html = this.parseContent(body.content);

        let users: Record<number, User> = {};
        users[userId] = await this.userManager.get(userId);

        let commentRaw = await this.postManager.createComment(userId, postId, parentCommentId, body.content, html);

        response.success({
            comment: {
                id: commentRaw.comment_id,
                created: commentRaw.created_at,
                author: commentRaw.author_id,
                content: format === 'html' ? commentRaw.html : commentRaw.source,
                rating: commentRaw.rating,
                parentComment: commentRaw.parent_comment_id
            },
            users: users
        } as CommentResponse);
    }

    private parseContent(content: string) {
        content = content.replace(/(\r\n|\n|\r)/gm, '<br/>');

        let html = sanitizeHtml(content, {
            allowedTags: ['b', 'i', 'u', 'strike', 'irony', 'a', 'span', 'br', 'img'],
            allowedAttributes: {
                'a': ['href'],
                'img': ['src'],
            },
            disallowedTagsMode: 'escape',
            transformTags: {
                'irony': () => {return { tagName: 'span', attribs: { 'class': 'irony' } }}
            },
            allowedClasses: {
                'span': ['irony']
            }
        });

        return html;
    }

    async read(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        let userId = request.session.data.userId;
        let body = <ReadRequest> request.body;
        let postId = body.post_id;
        let comments = body.comments;
        let lastCommentId = body.last_comment_id;

        if (!postId || comments === undefined) {
            return response.error('required', 'Post id and comments count required')
        }

        // update in background
        this.postManager.setRead(postId, userId, comments, lastCommentId)
            .then();

        response.success({});
    }

    async bookmark(request: express.Request, response: express.Response) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        let userId = request.session.data.userId;
        let body = <BookmarkRequest> request.body;
        let postId = body.post_id;
        let bookmark = body.bookmark;

        if (!postId || !bookmark) {
            return response.error('required', 'Post id and bookmark required')
        }

        await this.postManager.setBookmark(postId, userId, bookmark);
        response.success({ bookmark: bookmark });
    }
}
