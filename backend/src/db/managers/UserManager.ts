import {UserRaw} from '../types/UserRaw';
import {User, UserGender, UserProfile} from '../../types/User';
import UserRepository from '../repositories/UserRepository';
import VoteRepository from '../repositories/VoteRepository';
import bcrypt from 'bcryptjs';

export default class UserManager {
    private userRepository: UserRepository;
    private voteRepository: VoteRepository;
    private cacheId: Record<number, User> = {};
    private cacheUsername: Record<string, User> = {};

    constructor(voteRepository: VoteRepository, userRepository: UserRepository) {
        this.userRepository = userRepository;
        this.voteRepository = voteRepository;
    }

    async getById(userId: number): Promise<User | undefined> {
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

    private cache(user: User) {
        this.cacheId[user.id] = user;
        this.cacheUsername[user.username] = user;
    }

    async getByUsername(username: string): Promise<User | undefined> {
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

    async getInvitedBy(userId: number): Promise<User | undefined> {
        const invitedByRaw = await this.userRepository.getUserParent(userId);

        if (!invitedByRaw) {
            return;
        }

        return this.mapUserRaw(invitedByRaw);
    }

    async getInvites(userId: number): Promise<User[]> {
        const invitesRaw = await this.userRepository.getUserChildren(userId);

        return invitesRaw.map(raw => this.mapUserRaw(raw));
    }

    async checkPassword(username: string, password: string): Promise<User | false> {
        const userRaw = await this.userRepository.getUserByUsername(username);

        if (!await bcrypt.compare(password, userRaw.password)) {
            return false;
        }

        return this.mapUserRaw(userRaw);
    }

    async registerByInvite(inviteCde: string, username: string, name: string, email: string, passwordHash: string, gender: UserGender): Promise<User> {
        const userRaw = await this.userRepository.userRegister(inviteCde, username, name, email, passwordHash, gender);

        return this.mapUserRaw(userRaw);
    }

    private mapUserRaw(rawUser: UserRaw): User {
        return {
            id: rawUser.user_id,
            username: rawUser.username,
            gender: rawUser.gender,
            karma: rawUser.karma,
            name: rawUser.name
        };
    }
}
