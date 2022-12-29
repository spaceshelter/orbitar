import PostRepository from '../db/repositories/PostRepository';
import {PostRawWithUserData} from '../db/types/PostRaw';
import UserRepository from '../db/repositories/UserRepository';
import CodeError from '../CodeError';
import BookmarkRepository from '../db/repositories/BookmarkRepository';
import {PostInfo} from './types/PostInfo';
import {ContentFormat} from './types/common';
import {SiteInfo} from './types/SiteInfo';
import SiteManager from './SiteManager';
import {FeedSorting} from '../api/types/entities/common';
import {Logger} from 'winston';
import fetch from 'node-fetch';
import {config} from '../config';
import TheParser from '../parser/TheParser';

const FEED_API = `http://${config.feed.host}:${config.feed.port}`;

type Post = {
    ts: number;
    id: number;
};

type Batch = {
    subsite: string;
    posts: Post[];
};

type Query = {
    subsites: string[];
    offset: number;
    limit: number;
};
type QueryResponse = {
    post_ids: number[];
    total: number;
    cache_is_empty: boolean;
};

export default class FeedManager {
    private readonly bookmarkRepository: BookmarkRepository;
    private readonly postRepository: PostRepository;
    private readonly userRepository: UserRepository;
    private readonly siteManager: SiteManager;
    private initialized = undefined;
    /* minimal post created / updated date */
    private minDate: Date | undefined = undefined;
    /* when true, backend expects non-empty feed cache, will repopulate if discrepancy is found */
    private confirmedPostsExist = false;
    private readonly parser: TheParser;
    private readonly logger: Logger;

    private userSubscriptionsCache = new Map<number, number[]>();

    constructor(bookmarkRepository: BookmarkRepository, postRepository: PostRepository, userRepository: UserRepository,
                siteManager: SiteManager, parser: TheParser, logger: Logger) {
        this.bookmarkRepository = bookmarkRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.siteManager = siteManager;
        this.parser = parser;
        this.logger = logger;
    }

    private offsetPostTs(ts: Date): number {
        if (!this.minDate) {
            return 0;
        }
        // should never be negative, but just in case
        return Math.floor(Math.max(ts.getTime() - this.minDate.getTime(), 0) / 1000);
    }

    /**
     * Populates the feed cache with posts from the db.
     * Returns promise that resolves when the initialization is complete.
     * @param force to force repopulation (even if already initialized)
     * @return {Promise<number>} uuid of the initialization run
     */
    private initialize(force = false): Promise<number> {
        if (!this.initialized || force) {
            this.confirmedPostsExist = false;

            this.initialized = (async () => {
                const uuid = (new Date()).getTime() * 1000 + Math.floor(Math.random() * 1000);
                try {

                    this.minDate = await this.postRepository.getMinPostDate();
                    if (!this.minDate) {
                        return uuid;
                    }

                    await fetch(`${FEED_API}/clear`,
                        {method: 'POST'}
                    );

                    let sinceId = -1;
                    const batchSize = 1000;

                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const batch = await this.postRepository.getPostIdsAndSites(sinceId, batchSize);
                        if (batch.length === 0) {
                            break;
                        }
                        this.confirmedPostsExist = true;

                        const batchesBySite: Record<string, Batch> = {};
                        const addPostToBatch = (key: string, ts: number, id: number) => {
                            if (!batchesBySite[key]) {
                                batchesBySite[key] = {
                                    subsite: key,
                                    posts: [],
                                };
                            }
                            batchesBySite[key].posts.push({ts, id});
                        };

                        for (const post of batch) {
                            addPostToBatch(`${post.site_id}:new`,
                                this.offsetPostTs(post.created_at),
                                post.post_id);
                            addPostToBatch(`${post.site_id}:live`,
                                this.offsetPostTs(post.commented_at),
                                post.post_id);
                            sinceId = Math.max(sinceId, post.post_id);
                        }

                        await fetch(`${FEED_API}/update`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(Object.values(batchesBySite)),
                        });
                    }
                } catch (e) {
                    this.logger.error(e);
                    this.initialized = undefined;
                }
                return uuid;
            })();
        }
        return this.initialized;
    }

    async getSubscriptions(forUserId: number): Promise<number[]> {
        let userSubscriptions = this.userSubscriptionsCache.get(forUserId);
        if (!userSubscriptions) {
            userSubscriptions = await this.siteManager.getSiteSubscriptionIds(forUserId);
            this.userSubscriptionsCache.set(forUserId, userSubscriptions);
        }
        return userSubscriptions;
    }

    async getSubsiteKeys(forUserId: number, feedSorting: FeedSorting): Promise<string[]> {
        const subscriptions = await this.getSubscriptions(forUserId);
        return subscriptions.map(sub => `${sub}:${feedSorting == FeedSorting.postCreatedAt ? 'new' : 'live'}`);
    }

    async getSubscriptionFeed(forUserId: number, page: number, perpage: number, format: ContentFormat, sorting: FeedSorting):
        Promise<{total: number, posts: PostInfo[]}> {

        const prevInitUUID = await this.initialize();

        const limitFrom = (page - 1) * perpage;

        this.logger.profile(`getSubscriptionFeed/subsiteKeys:${forUserId}`);
        const keys = await this.getSubsiteKeys(forUserId, sorting);
        this.logger.profile(`getSubscriptionFeed/subsiteKeys:${forUserId}`);

        this.logger.profile(`getSubscriptionFeed/query:${forUserId}`);
        const { total, post_ids: postIds, cache_is_empty: cacheIsEmpty }  = await fetch(`${FEED_API}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subsites: keys,
                offset: limitFrom,
                limit: perpage,
            } as Query),
        }).then(res => res.json() as QueryResponse);
        this.logger.profile(`getSubscriptionFeed/query:${forUserId}`);

        /**
         * Discrepancy is found, repopulating feed cache:
         * - feed cache is empty, but posts exist in db
         *     (feed cache service was restarted)
         * - cache initialization didn't find any posts in db, but posts were added later
         *     (can happen once when starting from empty db)
         *
         *     cacheIsEmpty is true whe remote feed cache is empty
         *     this.minDate is undefined when initialization didn't happen or didn't find any posts in db
         */
        if (this.confirmedPostsExist && (cacheIsEmpty || !this.minDate)) {
            const curInitUUID = await this.initialize();
            // double-checked locking. Needed if the repopulation was already in progress.
            if (curInitUUID === prevInitUUID) {
                await this.initialize(true);
            }
            return this.getSubscriptionFeed(forUserId, page, perpage, format, sorting);
        }

        this.logger.profile(`getSubscriptionFeed/postsFetch:${forUserId}`);
        const posts: PostRawWithUserData[] =
            await this.postRepository.getPostsWithUserData(postIds, forUserId);

        // sort by the order of ids in the query
        posts.sort((a, b) =>
            postIds.indexOf(a.post_id) - postIds.indexOf(b.post_id));

        this.logger.profile(`getSubscriptionFeed/postsFetch:${forUserId}`);

        return {
            total,
            posts: await this.convertRawPost(forUserId, posts, format)
        };
    }

    async getSubscriptionsTotal(forUserId: number): Promise<number> {
        await this.initialize();

        return await fetch(`${FEED_API}/total`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(await this.getSubsiteKeys(forUserId, FeedSorting.postCreatedAt))
        }).then(res => res.json());
    }

    async getAllPosts(forUserId: number, page: number, perpage: number, format: ContentFormat, sorting: FeedSorting): Promise<PostInfo[]> {
        const rawPosts = await this.postRepository.getAllPosts(forUserId, page, perpage, sorting);
        return this.convertRawPost(forUserId, rawPosts, format);
    }

    async getAllPostsTotal(): Promise<number> {
        return await this.postRepository.getAllPostsTotal();
    }

    async getWatchFeed(forUserId: number, page: number, perpage: number, all = false, format: ContentFormat = 'html'): Promise<PostInfo[]> {
        const rawPosts = await this.postRepository.getWatchPosts(forUserId, page, perpage, all);
        return await this.convertRawPost(forUserId, rawPosts, format);
    }

    async getWatchTotal(forUserId: number, all = false): Promise<number> {
        return await this.postRepository.getWatchPostsTotal(forUserId, all);
    }


    async getSiteFeed(forUserId: number, siteId: number, page: number, perpage: number, format: ContentFormat, sorting: FeedSorting): Promise<PostInfo[]> {
        const rawPosts = await this.postRepository.getPosts(siteId, forUserId, page, perpage, sorting);
        return this.convertRawPost(forUserId, rawPosts, format);
    }

    async getSiteTotal(siteId: number): Promise<number> {
        return await this.postRepository.getPostsTotal(siteId);
    }


    async convertRawPost(forUserId: number, rawPosts: PostRawWithUserData[], format: ContentFormat): Promise<PostInfo[]> {
        const siteById: Record<number, SiteInfo> = {};
        const posts: PostInfo[] = [];
        const toUpdateHtmlAndParserVersion: {id: number, html: string}[] = [];

        for (const rawPost of rawPosts) {
            let site = siteById[rawPost.site_id];
            if (!site) {
                site = await this.siteManager.getSiteById(rawPost.site_id);
                siteById[rawPost.site_id] = site;
            }

            if (rawPost.parser_version !== TheParser.VERSION) {
                const parseResult = this.parser.parse(rawPost.source);
                toUpdateHtmlAndParserVersion.push({
                    id: rawPost.post_id,
                    html: rawPost.html !== parseResult.text ? parseResult.text : undefined,
                });
                rawPost.html = parseResult.text;
                rawPost.parser_version = TheParser.VERSION;
            }

            const post: PostInfo = {
                id: rawPost.post_id,
                site: site ? site.site : '',
                author: rawPost.author_id,
                created: rawPost.created_at,
                title: rawPost.title,
                content: format === 'html' ? rawPost.html : rawPost.source,
                rating: rawPost.rating,
                comments: rawPost.comments,
                newComments: rawPost.read_comments ? Math.max(0, rawPost.comments - rawPost.read_comments) : rawPost.comments,
                bookmark: !!rawPost.bookmark,
                watch: !!rawPost.watch,
                vote: rawPost.vote,
                lastReadCommentId: rawPost.last_read_comment_id,
                language: rawPost.language,
            };
            if (rawPost.author_id === forUserId) {
                post.canEdit = true;
            }
            if (rawPost.edit_flag) {
                post.editFlag = rawPost.edit_flag;
            }

            posts.push(post);
        }

        this.postRepository.updateHtmlAndParserVersion(toUpdateHtmlAndParserVersion.filter(x => x.html !== undefined),
            TheParser.VERSION).then().catch();
        this.postRepository.updateParserVersion(
            toUpdateHtmlAndParserVersion.filter(x => x.html === undefined).map(x => x.id),
            TheParser.VERSION).then().catch();

        return posts;
    }

    async siteSubscribe(userId: number, siteName: string, main: boolean, bookmarks: boolean) {
        const site = await this.siteManager.getSiteByName(siteName);
        if (!site) {
            throw new CodeError('no-site', 'Site not found');
        }

        const existingSubscription = await this.siteManager.getSubscription(userId, site.id);
        if (existingSubscription && !!existingSubscription.feed_main === main &&
            !!existingSubscription.feed_bookmarks === bookmarks) {
            return { main, bookmarks };
        }

        await this.siteManager.siteSubscribe(userId, site.id, main, bookmarks);

        if ((!!existingSubscription.feed_main) !== main) {
            this.logger.info(`Clearing feed cache for user ${userId} after subscribing to ${siteName}`);
            this.userSubscriptionsCache.delete(userId);
        }

        return { main, bookmarks };
    }

    async postFanOut(subsite_id: number, post_id: number, createdAt: Date | undefined, updatedAt: Date | undefined) {
        this.confirmedPostsExist = true;
        if (!this.initialized || !this.minDate) {
            return;
        }
        const batch = [];
        let dbUpdateJob;

        if (createdAt) {
            batch.push({subsite: `${subsite_id}:new`, posts: [{id: post_id, ts: this.offsetPostTs(createdAt)}]});
        }
        if (updatedAt) {
            batch.push({subsite: `${subsite_id}:live`, posts: [{id: post_id, ts: this.offsetPostTs(updatedAt)}]});
            dbUpdateJob = (async () => {
                this.logger.profile(`postFanOut/setUpdated:${post_id}`);
                await this.bookmarkRepository.setUpdated(post_id, updatedAt);
                this.logger.profile(`postFanOut/setUpdated:${post_id}`);
            })();
        }
        if (batch.length > 0) {
            await fetch(`${FEED_API}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batch),
            });
        }
        if (dbUpdateJob) {
            await dbUpdateJob;
        }
    }

}
