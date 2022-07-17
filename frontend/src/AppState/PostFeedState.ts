import {getCachedValue, setCachedValue} from '../API/use/useCache';
import {PostInfo} from '../Types/PostInfo';
import {action, computed, makeObservable, observable, runInAction} from 'mobx';
import APIHelper from '../API/APIHelper';

export enum PostsFeedStateType {
    Loading,
    Ready,
    Error
}

type GetPostsResult = {
    posts: PostInfo[];
    total: number;
};

export abstract class PostsFeedStateBase {

    protected readonly api: APIHelper;

    @observable
    page = 1;

    @observable
    perPage: number;

    @observable
    pages = 0;

    @observable
    status: PostsFeedStateType = PostsFeedStateType.Loading;

    readonly posts = observable.array<PostInfo>([]);

    protected getPosts!: () => Promise<GetPostsResult>;

    constructor(api: APIHelper, perPage: number) {
        this.api = api;
        this.perPage = perPage;
        this.loadFromCache();
        makeObservable(this);
    }

    @computed
    get loading(): boolean {
        return this.status === PostsFeedStateType.Loading;
    }

    @computed
    get error(): boolean {
        return this.status === PostsFeedStateType.Error;
    }

    @action
    protected setPage(page: number) {
        this.page = page;
    }

    @action
    protected setPages(pages: number) {
        this.pages = pages;
    }

    @action
    protected setStatus(status: PostsFeedStateType) {
        this.status = status;
    }

    @action
    protected setPosts(posts: PostInfo[]) {
        this.posts.replace(posts);
    }

    @action // won't be needed after all PostFeeds are transitioned to MobX
    updatePost = (id: number, partial: Partial<PostInfo>) => {
        const index = this.posts.findIndex(post => post.id === id);
        if (index !== -1) {
            Object.assign(this.posts[index], partial);
        }
    };

    private loadFromCache() {
        const cachedPosts: PostInfo[] | undefined = getCachedValue('feed', []);
        if (cachedPosts) {
            this.setPosts(cachedPosts);
        }
    }

    loadPage(page: number): Promise<void> {
        runInAction(() => {
            this.setPage(page);
            this.setStatus(PostsFeedStateType.Loading);
            this.loadFromCache();
        });
        return this.loadPosts();
    }

    private async loadPosts() {
        try {
            const curPage = this.page;
            const postsResult = await this.getPosts();
            setCachedValue('feed', [], postsResult.posts);

            if (curPage === this.page) {
                // If the page has changed, we don't want to replace the posts
                runInAction(() => {
                    this.setPosts(postsResult.posts);
                    this.setStatus(PostsFeedStateType.Ready);
                    this.setPages(Math.floor((postsResult.total - 1) / this.perPage) + 1);
                });
            }
        } catch (e) {
            this.setStatus(PostsFeedStateType.Error);
        }
    }
}

export class WatchPostsFeedState extends PostsFeedStateBase {
    constructor(api: APIHelper, isAll: boolean, perPage: number) {
        super(api, perPage);
        this.getPosts = () => this.api.post.feedWatch(isAll, this.page, this.perPage);
    }
}

export class SitePostsFeedState extends PostsFeedStateBase {
    constructor(api: APIHelper, siteName: string, perPage: number) {
        super(api, perPage);
        this.getPosts = () => this.api.post.feedPosts(siteName, this.page, this.perPage);
    }
}

export class AllPostsFeedState extends PostsFeedStateBase {
    constructor(api: APIHelper, perPage: number) {
        super(api, perPage);
        this.getPosts = () => this.api.post.feedAll(this.page, this.perPage);
    }
}

export class SubscriptionsPostsFeedState extends PostsFeedStateBase {
    constructor(api: APIHelper, perPage: number) {
        super(api, perPage);
        this.getPosts = () => this.api.post.feedSubscriptions(this.page, this.perPage);
    }
}

export class UserPostsFeedState extends PostsFeedStateBase {
    constructor(api: APIHelper, username: string, perPage: number) {
        super(api, perPage);
        this.getPosts = () => this.api.userAPI.userPosts(username, this.page, this.perPage);
    }
}