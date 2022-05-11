import PostAPI, {CommentEntity, PostEntity} from './PostAPI'
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import {SiteInfo} from '../Types/SiteInfo';
import APICache from './APICache';
import {AppStateSetters} from '../AppState/AppState';
import {UserInfo} from "../Types/UserInfo"

type FeedPostsResult = {
    posts: PostInfo[];
    site: SiteInfo;
    total: number;
}
type FeedSubscriptionsResult = {
    posts: PostInfo[];
    sites: Record<string, SiteInfo>;
    total: number;
}

type PostResult = {
    post: PostInfo;
    comments: CommentInfo[];
    site: SiteInfo;
    lastCommentId: number;
}

interface CommentResponse {
    comment: CommentInfo;
}

export default class PostAPIHelper {
    private postAPI: PostAPI;
    private cache: APICache;
    private setters: AppStateSetters

    constructor(postAPI: PostAPI, setters: AppStateSetters, cache: APICache) {
        this.postAPI = postAPI;
        this.cache = cache;
        this.setters = setters;
    }

    async create(site: string, title: string, content: string) {

    }

    async get(postId: number): Promise<PostResult> {
        const response = await this.postAPI.get(postId);
        const siteInfo = this.cache.setSite(response.site);

        const post: PostInfo = { ...response.post } as any;
        // fix fields
        post.author = this.cache.setUser(response.users[response.post.author]);
        post.created = this.postAPI.api.fixDate(new Date(response.post.created));


        const comments = this.fixComments(response.comments, response.users);
        const lastCommentId = this.getLastCommentId(response.comments) || 0;

        return {
            post: post,
            comments: comments,
            site: siteInfo,
            lastCommentId: lastCommentId
        };
    }

    async feedPosts(site: string, page: number, perPage: number): Promise<FeedPostsResult> {
        const response = await this.postAPI.feedPosts(site, page, perPage);
        const siteInfo = this.cache.setSite(response.site);
        return {
            posts: this.fixPosts(response.posts, response.users),
            site: siteInfo,
            total: response.total
        };
    }

    async feedSubscriptions(page: number, perPage: number): Promise<FeedSubscriptionsResult> {
        const response = await this.postAPI.feedSubscriptions(page, perPage);
        return {
            posts: this.fixPosts(response.posts, response.users),
            sites: response.sites,
            total: response.total
        };
    }

    async feedWatch(all: boolean, page: number, perPage: number): Promise<FeedSubscriptionsResult> {
        const response = await this.postAPI.feedWatch(all, page, perPage);
        return {
            posts: this.fixPosts(response.posts, response.users),
            sites: response.sites,
            total: response.total
        };
    }

    fixPosts(posts: PostEntity[], users: Record<number, UserInfo>): PostInfo[] {
        return posts.map(post => {
            const p: PostInfo = { ...post } as any;
            // fix fields
            p.author = this.cache.setUser(users[post.author]);
            p.created = this.postAPI.api.fixDate(new Date(post.created));

            this.cache.setPost(p);
            return p;
        });
    }

    fixComments(comments: CommentEntity[], users: Record<number, UserInfo>): CommentInfo[] {
        return comments.map(comment => {
            const c: CommentInfo = { ...comment } as any;
            // fix fields
            c.author = this.cache.setUser(users[comment.author]);
            c.created = this.postAPI.api.fixDate(new Date(comment.created));
            c.postLink = {
                id: comment.post,
                site: comment.site
            }

            if (comment.answers) {
                c.answers = this.fixComments(comment.answers, users);
            }
            return c;
        });
    }

    getLastCommentId(comments: CommentEntity[]): number | undefined {
        return comments.reduce((lastCommentId: number | undefined, comment) =>
            Math.max(lastCommentId || comment.id, comment.id,
                comment.answers && this.getLastCommentId(comment.answers) || comment.id), undefined);
    }

    async comment(content: string, postId: number, commentId?: number): Promise<CommentResponse> {
        const response = await this.postAPI.comment(content, postId, commentId);

        const [comment] = this.fixComments([response.comment], response.users);

        return {
            comment
        };
    }

    async read(postId: number, comments: number, lastCommentId?: number) {
        const result = await this.postAPI.read(postId, comments, lastCommentId);
        if (result.watch) {
            this.setters.setUserStats((old) => {
                return { ...old, watch: result.watch, notifications: result.notifications };
            });
        }
        return result;
    }

    async bookmark(postId: number, bookmark: boolean) {
        return await this.postAPI.bookmark(postId, bookmark);
    }

    async watch(postId: number, watch: boolean) {
        return await this.postAPI.watch(postId, watch);
    }
}
