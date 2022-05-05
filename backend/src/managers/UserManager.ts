import {UserRaw} from '../db/types/UserRaw';
import {UserInfo, UserGender, UserProfile, UserStats} from './types/UserInfo';
import UserRepository from '../db/repositories/UserRepository';
import VoteRepository from '../db/repositories/VoteRepository';
import bcrypt from 'bcryptjs';
import NotificationManager from './NotificationManager';

export default class UserManager {
    private userRepository: UserRepository;
    private voteRepository: VoteRepository;
    private notificationManager: NotificationManager;

    private cacheId: Record<number, UserInfo> = {};
    private cacheUsername: Record<string, UserInfo> = {};

    constructor(voteRepository: VoteRepository, userRepository: UserRepository, notificationManager: NotificationManager) {
        this.userRepository = userRepository;
        this.voteRepository = voteRepository;
        this.notificationManager = notificationManager;
    }

    async getById(userId: number): Promise<UserInfo | undefined> {
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

    private cache(user: UserInfo) {
        this.cacheId[user.id] = user;
        this.cacheUsername[user.username] = user;
    }

    async getByUsername(username: string): Promise<UserInfo | undefined> {
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

    async getFullProfile(username: string, forUserId: number): Promise<UserProfile | undefined> {
        const rawUser = await this.userRepository.getUserByUsername(username);
        if (!rawUser) {
            return;
        }

        const vote = await this.voteRepository.getUserVote(rawUser.user_id, forUserId);

        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name,
            registered: rawUser.registered_at,
            vote: vote
        };
    }

    async getInvitedBy(userId: number): Promise<UserInfo | undefined> {
        const invitedByRaw = await this.userRepository.getUserParent(userId);

        if (!invitedByRaw) {
            return;
        }

        return this.mapUserRaw(invitedByRaw);
    }

    async getInvites(userId: number): Promise<UserInfo[]> {
        const invitesRaw = await this.userRepository.getUserChildren(userId);

        return invitesRaw.map(raw => this.mapUserRaw(raw));
    }

    async checkPassword(username: string, password: string): Promise<UserInfo | false> {
        const userRaw = await this.userRepository.getUserByUsername(username);

        if (!await bcrypt.compare(password, userRaw.password)) {
            return false;
        }

        return this.mapUserRaw(userRaw);
    }

    async registerByInvite(inviteCde: string, username: string, name: string, email: string, passwordHash: string, gender: UserGender): Promise<UserInfo> {
        const userRaw = await this.userRepository.userRegister(inviteCde, username, name, email, passwordHash, gender);

        return this.mapUserRaw(userRaw);
    }

    async getUserStats(forUserId: number): Promise<UserStats> {
        const unreadComments = await this.userRepository.getUserUnreadComments(forUserId);
        const notifications = await this.notificationManager.getNotificationsCount(forUserId);

        return {
            notifications,
            watch: {
                comments: unreadComments,
                posts: 0
            }
        };
    }

    private mapUserRaw(rawUser: UserRaw): UserInfo {
        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name
        };
    }
}
