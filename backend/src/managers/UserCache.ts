import {UserInfo, UserStats} from './types/UserInfo';
import UserRepository from '../db/repositories/UserRepository';
import {UserRaw} from '../db/types/UserRaw';

export class UserCache {
    private userRepository: UserRepository;
    /**
     * Cache initialized state:
     * - false: not initialized
     * - Promise<void>: initializing, wait for it
     * - true: initialized
     */
    private initializedState: Promise<void> | boolean = false;
    private cacheId: Record<number, UserInfo> = {};
    private cacheUsername: Record<string, UserInfo> = {};
    private cachedUserParents: Record<number, number | undefined | false> = {};
    private userStatsCache = new Map<number, UserStats>();

    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository;
    }

    private initialize() {
        if (!this.initializedState) {
            this.initializedState = (async () => {
                const users = await this.userRepository.getLastActiveUsers();
                for (const user of users) {
                    this.cache(this.mapUserRaw(user));
                }
                this.initializedState = true;
            })();
        }
        return this.initializedState;
    }

    public async getById(userId: number): Promise<UserInfo | undefined> {
        if (this.initializedState !== true) {
            await this.initialize();
        }

        if (this.cacheId[userId]) {
            return this.cacheId[userId];
        }

        const rawUser = await this.userRepository.getUserById(userId);

        if (!rawUser) {
            return;
        }

        const user = this.mapUserRaw(rawUser);
        this.cache(user);
        return user;
    }

    public clearCache(userId: number) {
        const cacheEntry = this.cacheId[userId];
        if (!cacheEntry) {
            return;
        }
        delete this.cacheId[userId];
        delete this.cacheUsername[cacheEntry.username];
    }

    private cache(user: UserInfo) {
        this.cacheId[user.id] = user;
        this.cacheUsername[user.username] = user;
    }

    public async getByUsername(username: string): Promise<UserInfo | undefined> {
        if (this.cacheUsername[username]) {
            return this.cacheUsername[username];
        }

        const rawUser = await this.userRepository.getUserByUsername(username);

        if (!rawUser) {
            return;
        }

        const user = this.mapUserRaw(rawUser);
        this.cache(user);
        return user;
    }

    public async getUserParent(userId: number): Promise<UserInfo|undefined> {
        // check cache
        const cachedParent = this.cachedUserParents[userId];
        if (cachedParent === false) {
            return undefined;
        } else if (cachedParent) {
            return this.getById(cachedParent);
        }
        const parent = await this.userRepository.getUserParent(userId);
        this.cachedUserParents[userId] = parent !== undefined ? parent.user_id : false;
        return this.getById(parent.user_id);
    }

    public mapUserRaw(rawUser: UserRaw): UserInfo {
        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name,
            registered: rawUser.registered_at,
            ontrial: rawUser.ontrial === 1,
            bio_source: rawUser.bio_source,
            bio_html: rawUser.bio_html
        };
    }

    getUserStatsCache(forUserId: number): UserStats | undefined {
        return this.userStatsCache.get(forUserId);
    }

    cacheUserStats(forUserId: number, stats: UserStats) {
        this.userStatsCache.set(forUserId, stats);
    }

    deleteUserStatsCache(forUserId: number) {
        this.userStatsCache.delete(forUserId);
    }

    clearUserStatsCache() {
        this.userStatsCache.clear();
    }
}