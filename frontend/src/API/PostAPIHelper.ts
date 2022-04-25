import PostAPI from './PostAPI';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import {SiteInfo} from '../Types/SiteInfo';
import APICache from './APICache';

interface FeedResponse {
    posts: PostInfo[];
    site: SiteInfo;
    total: number;
}

interface PostResponse {
    post: PostInfo;
    comments: CommentInfo[];
    site: SiteInfo;
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

    async get(postId: number): Promise<PostResponse> {
        let response = await this.postAPI.get(postId);
        let siteInfo = this.cache.setSite(response.site);

        let post: any = { ...response.post };
        // fix fields
        post.author = this.cache.setUser(response.users[post.author]);
        post.created = new Date(post.created);

        const fixComments = (comments: CommentInfo[]) => {
            return comments.map(comment => {
                let c: any = { ...comment };
                // fix fields
                c.author = this.cache.setUser(response.users[c.author]);
                c.created = new Date(comment.created);

                if (c.answers) {
                    c.answers = fixComments(c.answers);
                }

                return c;
            });
        }

        let comments = fixComments(response.comments);

        return {
            post: post,
            comments: comments,
            site: siteInfo
        };
    }

    async feed(site: string, page: number, perPage: number): Promise<FeedResponse> {
        let response = await this.postAPI.feed(site, page, perPage);
        let siteInfo = this.cache.setSite(response.site);

        let posts: PostInfo[] = response.posts.map(post => {
            let p: any = { ...post };
            // fix fields
            p.author = this.cache.setUser(response.users[post.author]);
            p.created = new Date(post.created);

            this.cache.setPost(p);
            return p;
        });



        return {
            posts: posts,
            site: siteInfo,
            total: response.total
        };
    }

    async comment(content: string, postId: number, commentId?: number): Promise<CommentResponse> {
        let response = await this.postAPI.comment(content, postId, commentId);

        let c: any = { ...response.comment }
        c.author = this.cache.setUser(response.users[c.author]);
        c.created = new Date(c.created);

        return {
            comment: c
        };
    }
}
