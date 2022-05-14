import {getCachedValue, setCachedValue} from '../API/use/useCache';
import {PostInfo} from '../Types/PostInfo';
import {action, computed, makeObservable, observable, runInAction} from 'mobx';
import APIHelper from '../API/APIHelper';

export enum PostFeedStateType {
    Loading,
    Ready,
    Error
}

type GetPostsResult = {
    posts: PostInfo[];
    total: number;
};

export abstract class PostFeedStateBase {

    protected readonly api: APIHelper;

    @observable
    page = 1;

    @observable
    perPage: number;

    @observable
    pages = 0;

    @observable
    status: PostFeedStateType = PostFeedStateType.Loading;

    readonly posts = observable.array<PostInfo>([]);

    constructor(api: APIHelper, perPage: number) {
        this.api = api;
        this.perPage = perPage;
        this.loadFromCache();
        makeObservable(this);
    }

    abstract getPosts(): Promise<GetPostsResult>;

    @computed
    get loading(): boolean {
        return this.status === PostFeedStateType.Loading;
    }

    @computed
    get error(): boolean {
        return this.status === PostFeedStateType.Error;
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
    protected setStatus(status: PostFeedStateType) {
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
            this.setStatus(PostFeedStateType.Loading);
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
                    this.setStatus(PostFeedStateType.Ready);
                    this.setPages(Math.floor((postsResult.total - 1) / this.perPage) + 1);
                });
            }
        } catch (e) {
            this.setStatus(PostFeedStateType.Error);
        }
    }
}

export class WatchPostFeedState extends PostFeedStateBase {
    private readonly isAll: boolean;

    constructor(api: APIHelper, siteName: string, isAll: boolean, perPage: number) {
        super(api, perPage);
        this.isAll = isAll;
    }

    override getPosts(): Promise<GetPostsResult> {
        return this.api.post.feedWatch(this.isAll, this.page, this.perPage);
    }
}

