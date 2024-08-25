import PostAPI, {CommentEntity, PostEntity} from './PostAPI';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import {SiteInfo} from '../Types/SiteInfo';
import {AppState} from '../AppState/AppState';
import {UserInfo} from '../Types/UserInfo';
import {HistoryInfo} from '../Types/HistoryInfo';
import {FeedSorting} from '../Types/FeedSortingSettings';

type FeedPostsResult = {
    posts: PostInfo[];
    site: SiteInfo;
    total: number;
    sorting: FeedSorting;
};
type FeedSubscriptionsResult = {
    posts: PostInfo[];
    sites: Record<string, SiteInfo>;
    total: number;
    sorting: FeedSorting;
};

type PostResult = {
    post: PostInfo;
    comments: CommentInfo[];
    site: SiteInfo;
    lastCommentId: number;
    anonymousUser?: UserInfo;
};

type PostCommentResult = {
    comment: CommentInfo;
};

type PostCommentEditResult = {
    comment: CommentInfo;
};

type PostEditResult = {
    post: PostInfo;
};

export default class PostAPIHelper {
    private postAPI: PostAPI;
    private appState: AppState;

    constructor(postAPI: PostAPI, appState: AppState) {
        this.postAPI = postAPI;
        this.appState = appState;
    }

    async get(postId: number, noComments = false): Promise<PostResult> {
        const response = await this.postAPI.get(postId, 'html', noComments);
        const siteInfo = this.appState.cache.setSite(response.site);

        const post: PostInfo = { ...response.post } as unknown as PostInfo;
        // fix fields
        post.author = this.appState.cache.setUser(response.users[response.post.author]);
        post.created = this.postAPI.api.fixDate(new Date(response.post.created));


        const comments = this.fixComments(response.comments, response.users);
        const lastCommentId = this.getLastCommentId(response.comments) || 0;

        return {
            post: post,
            comments: comments,
            site: siteInfo,
            lastCommentId: lastCommentId,
            anonymousUser: response.anonymousUser
        };
    }

    async getComment(commentId: number): Promise<CommentInfo> {
        const response = await this.postAPI.getComment(commentId, 'html');
        return this.fixComment(response.comment, response.users);
    }

    async feedPosts(site: string, page: number, perPage: number): Promise<FeedPostsResult> {
        const response = await this.postAPI.feedPosts(site, page, perPage);
        const siteInfo = this.appState.cache.setSite(response.site);
        return {
            posts: this.fixPosts(response.posts, response.users),
            site: siteInfo,
            total: response.total,
            sorting: response.sorting
        };
    }

    async feedSubscriptions(page: number, perPage: number): Promise<FeedSubscriptionsResult> {
        const response = await this.postAPI.feedSubscriptions(page, perPage);
        return {
            posts: this.fixPosts(response.posts, response.users),
            sites: response.sites,
            total: response.total,
            sorting: response.sorting
        };
    }

    async feedAll(page: number, perPage: number): Promise<FeedSubscriptionsResult> {
        const response = await this.postAPI.feedAll(page, perPage);
        return {
            posts: this.fixPosts(response.posts, response.users),
            sites: response.sites,
            total: response.total,
            sorting: response.sorting
        };
    }

    async feedWatch(all: boolean, page: number, perPage: number): Promise<FeedSubscriptionsResult> {
        const response = await this.postAPI.feedWatch(all, page, perPage);
        return {
            posts: this.fixPosts(response.posts, response.users),
            sites: response.sites,
            total: response.total,
            sorting: FeedSorting.postCommentedAt
        };
    }

    fixPosts(posts: PostEntity[], users: Record<number, UserInfo>): PostInfo[] {
        return posts.map(post => {
            const p: PostInfo = { ...post } as unknown as PostInfo;
            // fix fields
            p.author = this.appState.cache.setUser(users[post.author]);
            p.created = this.postAPI.api.fixDate(new Date(post.created));

            this.appState.cache.setPost(p);
            return p;
        });
    }

    private fixComment(comment: CommentEntity, users: Record<number, UserInfo>): CommentInfo {
        const c: CommentInfo = { ...comment } as unknown as CommentInfo;
        // fix fields
        c.author = this.appState.cache.setUser(users[comment.author]);
        c.created = this.postAPI.api.fixDate(new Date(comment.created));
        c.postLink = {
            id: comment.post,
            site: comment.site
        };

        if (comment.answers) {
            c.answers = this.fixComments(comment.answers, users);
        }
        return c;
    }

    fixCommentsRecords(comments: Record<number, CommentEntity>, users: Record<number, UserInfo>): Record<number, CommentInfo> {
        const result: Record<number, CommentInfo> = {};
        for (const commentId in comments) {
            result[commentId] = this.fixComment(comments[commentId], users);
        }
        return result;
    }

    fixComments(comments: CommentEntity[], users: Record<number, UserInfo>): CommentInfo[] {
        return comments.map(comment => this.fixComment(comment, users));
    }

    getLastCommentId(comments: CommentEntity[]): number | undefined {
        return comments.reduce((lastCommentId: number | undefined, comment) =>
            Math.max(lastCommentId || comment.id, comment.id,
                (comment.answers && this.getLastCommentId(comment.answers)) || comment.id), undefined);
    }

    async comment(content: string, postId: number, commentId?: number): Promise<PostCommentResult> {
        const response = await this.postAPI.comment(content, postId, commentId);

        const [comment] = this.fixComments([response.comment], response.users);

        return {
            comment
        };
    }

    async editComment(content: string, commentId: number): Promise<PostCommentEditResult> {
        const response = await this.postAPI.editComment(content, commentId);

        const [comment] = this.fixComments([response.comment], response.users);

        return {
            comment
        };
    }

    async editPost(postId: number, title: string, content: string): Promise<PostEditResult> {
        const response = await this.postAPI.editPost(postId, title, content);

        const [post] = this.fixPosts([response.post], response.users);

        return {
            post
        };
    }

    async read(postId: number, comments: number, lastCommentId?: number) {
        const result = await this.postAPI.read(postId, comments, lastCommentId);
        if (result.watch !== undefined && result.notifications !== undefined) {
            this.appState.setUnreadNotificationsCount(result.notifications.unread);
            this.appState.setVisibleNotificationsCount(result.notifications.visible);
            this.appState.setWatchCommentsCount(result.watch.comments);
        }
        return result;
    }

    async bookmark(postId: number, bookmark: boolean) {
        return await this.postAPI.bookmark(postId, bookmark);
    }

    async watch(postId: number, watch: boolean) {
        return await this.postAPI.watch(postId, watch);
    }

    async history(id: number, type: string): Promise<HistoryInfo[]> {
        const result = await this.postAPI.history(id, type);
        return result.history.map(h => {
            const info: HistoryInfo = {
                ...h
            } as unknown as HistoryInfo;
            info.date = this.postAPI.api.fixDate(new Date(h.date));
            return info;
        });
    }
}
