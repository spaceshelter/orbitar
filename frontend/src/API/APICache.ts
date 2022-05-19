import {UserInfo} from '../Types/UserInfo';
import {PostInfo} from '../Types/PostInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';

export default class APICache {
    private userCache: Record<number, UserInfo> = {};
    private postCache: Record<number, PostInfo> = {};
    private siteCache: Record<string, SiteWithUserInfo> = {};

    setUser(user: UserInfo): UserInfo {
        this.userCache[user.id] = user;
        return user;
    }

    setPost(post: PostInfo): PostInfo {
        this.postCache[post.id] = post;
        return post;
    }

    getPost(postId: number): PostInfo | undefined {
        return this.postCache[postId];
    }

    setSite(site: SiteWithUserInfo): SiteWithUserInfo {
        this.siteCache[site.site] = site;
        return site;
    }

    getSite(site: string): SiteWithUserInfo | undefined {
        return this.siteCache[site];
    }
}
