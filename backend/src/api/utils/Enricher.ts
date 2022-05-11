import {PostRawWithUserData} from '../../db/types/PostRaw';
import {SiteBaseEntity} from '../types/entities/SiteEntity';
import {UserEntity} from '../types/entities/UserEntity';
import {PostEntity} from '../types/entities/PostEntity';
import UserManager from '../../managers/UserManager';
import SiteManager from '../../managers/SiteManager';

export type EnrichedPosts = {
    posts: PostEntity[]
    users: Record<number, UserEntity>
    sites: Record<number, SiteBaseEntity>
};

export class Enricher {
    private readonly siteManager: SiteManager;
    private readonly userManager: UserManager;

    constructor(siteManager: SiteManager, userManager: UserManager) {
        this.siteManager = siteManager;
        this.userManager = userManager;
    }

    async enrichRawPosts(rawPosts: PostRawWithUserData[], format: string): Promise<EnrichedPosts> {
        const sitesById: Record<number, SiteBaseEntity> = {};
        const sites: Record<string, SiteBaseEntity> = {};
        const users: Record<number, UserEntity> = {};
        const posts: PostEntity[] = [];
        for (const post of rawPosts) {
            if (!users[post.author_id]) {
                users[post.author_id] = await this.userManager.getById(post.author_id);
            }

            let siteName = '';
            if (!sitesById[post.site_id]) {
                const site = await this.siteManager.getSiteById(post.site_id);
                const baseSite = {
                    id: site.id,
                    site: site.site,
                    name: site.name
                };
                sitesById[post.site_id] = baseSite;
                sites[site.site] = baseSite;

                siteName = site?.site || '';
            }
            else {
                siteName = sitesById[post.site_id].site;
            }

            posts.push({
                id: post.post_id,
                site: siteName,
                author: post.author_id,
                created: post.created_at.toISOString(),
                title: post.title,
                content: format === 'html' ? post.html : post.source,
                rating: post.rating,
                comments: post.comments,
                newComments: post.read_comments ? Math.max(0, post.comments - post.read_comments) : post.comments,
                bookmark: !!post.bookmark,
                watch: !!post.watch,
                vote: post.vote
            });
        }

        return {
            posts,
            users,
            sites
        };
    }
}