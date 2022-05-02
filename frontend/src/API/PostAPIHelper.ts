import PostAPI, {CommentEntity} from './PostAPI';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import {SiteInfo} from '../Types/SiteInfo';
import APICache from './APICache';

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

    constructor(postAPI: PostAPI, cache: APICache) {
        this.postAPI = postAPI;
        this.cache = cache;
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

        let lastCommentId = 0;

        const fixComments = (fix: CommentEntity[]) => {
            return fix.map(comment => {
                lastCommentId = Math.max(lastCommentId, comment.id);
                const c: CommentInfo = { ...comment } as any;
                // fix fields
                c.author = this.cache.setUser(response.users[comment.author]);
                c.created = this.postAPI.api.fixDate(new Date(comment.created));

                if (comment.answers) {
                    c.answers = fixComments(comment.answers);
                }

                return c;
            });
        }

        const comments = fixComments(response.comments);

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

        const posts: PostInfo[] = response.posts.map(post => {
            const p: PostInfo = { ...post } as any;
            // fix fields
            p.author = this.cache.setUser(response.users[post.author]);
            p.created = this.postAPI.api.fixDate(new Date(post.created));

            this.cache.setPost(p);
            return p;
        });

        return {
            posts: posts,
            site: siteInfo,
            total: response.total
        };
    }

    async feedSubscriptions(page: number, perPage: number): Promise<FeedSubscriptionsResult> {
        const response = await this.postAPI.feedSubscriptions(page, perPage);

        const posts: PostInfo[] = response.posts.map(post => {
            const p: PostInfo = { ...post } as any;
            // fix fields
            p.author = this.cache.setUser(response.users[post.author]);
            p.created = this.postAPI.api.fixDate(new Date(post.created));

            this.cache.setPost(p);
            return p;
        });

        return {
            posts: posts,
            sites: response.sites,
            total: response.total
        };
    }

    async comment(content: string, postId: number, commentId?: number): Promise<CommentResponse> {
        const response = await this.postAPI.comment(content, postId, commentId);

        const c: any = { ...response.comment }
        c.author = this.cache.setUser(response.users[c.author]);
        c.created = this.postAPI.api.fixDate(new Date(c.created));

        return {
            comment: c
        };
    }

    async read(postId: number, comments: number, lastCommentId?: number) {
        return await this.postAPI.read(postId, comments, lastCommentId);
    }
}
