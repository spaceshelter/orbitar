import TrieSearch from 'trie-search'

import UserRepository from '../db/repositories/UserRepository'
import { UserRaw } from '../db/types/UserRaw'
import { UserInfo, UserStats } from './types/UserInfo'

export type UserCacheEviction = {
  byId: boolean
  /** every username key that pointed at the user, including ones left behind by a rename */
  usernameKeys: string[]
  publicKey: boolean
  parent: boolean
  stats: boolean
}

export type UserCacheStats = {
  byId: number
  byUsername: number
  parents: number
  publicKeys: number
  stats: number
  usernameSuggestions: number
}

export type UserCacheInspection = {
  byId: UserInfo | undefined
  usernameKeys: string[]
  /** false when a username key points at a different object than the id entry (an orphan) */
  consistent: boolean
  publicKeyCached: boolean
  parentCached: boolean
  statsCached: boolean
}

export class UserCache {
  private userRepository: UserRepository
  /**
   * Cache initialized state:
   * - false: not initialized
   * - Promise<void>: initializing, wait for it
   * - true: initialized
   */
  private initializedState: Promise<void> | boolean = false
  private cacheId: Record<number, UserInfo> = {}
  private cacheUsername: Record<string, UserInfo> = {}
  /** reverse index of cacheUsername: every key that has pointed at a user id, so eviction stays O(1) */
  private usernameKeysById = new Map<number, Set<string>>()
  private cachedUserParents: Record<number, number | undefined | false> = {}
  private cachedPublicKeys: Record<number, string | undefined> = {}
  private usernamesSuggestionsCache = UserCache.createSuggestionsTrie()
  private usernamesSuggestionsCount = 0
  private userStatsCache = new Map<number, UserStats>()

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository
    ;(async () => {
      await this.rebuildUsernameSuggestions()
    })()
  }

  private static createSuggestionsTrie() {
    return new TrieSearch('k', { min: 1 })
  }

  /**
   * Rebuilds the username suggestions trie from the DB and swaps it in atomically.
   * The trie only ever grows (on registration), so renames and deletions need this.
   * Returns the number of usernames loaded.
   */
  public async rebuildUsernameSuggestions(): Promise<number> {
    const trie = UserCache.createSuggestionsTrie()
    const usersCount = await this.userRepository.getUserCount()
    let count = 0
    for (let i = 0; i < usersCount; i += 1000) {
      const usernames = await this.userRepository.getUsernames(i)
      trie.addAll(usernames.map((user) => ({ k: user.username.toLowerCase(), v: user.username })))
      count += usernames.length
    }
    this.usernamesSuggestionsCache = trie
    this.usernamesSuggestionsCount = count
    return count
  }

  private initialize() {
    if (!this.initializedState) {
      this.initializedState = (async () => {
        const users = await this.userRepository.getLastActiveUsers()
        for (const user of users) {
          this.cache(this.mapUserRaw(user))
        }
        this.initializedState = true
      })()
    }
    return this.initializedState
  }

  public async getById(userId: number): Promise<UserInfo | undefined> {
    if (this.initializedState !== true) {
      await this.initialize()
    }

    if (this.cacheId[userId]) {
      return this.cacheId[userId]
    }

    const rawUser = await this.userRepository.getUserById(userId)

    if (!rawUser) {
      return
    }

    const user = this.mapUserRaw(rawUser)
    this.cache(user)
    return user
  }

  public async getByIds(userIds: number[]): Promise<Record<number, UserInfo>> {
    if (!userIds.length) {
      return {}
    }

    if (this.initializedState !== true) {
      await this.initialize()
    }

    const users: Record<number, UserInfo> = {}
    const missingIds: number[] = []
    for (const userId of new Set(userIds)) {
      if (this.cacheId[userId]) {
        users[userId] = this.cacheId[userId]
      } else {
        missingIds.push(userId)
      }
    }

    const rawUsers = await this.userRepository.getUsersByIds(missingIds)
    for (const rawUser of rawUsers) {
      const user = this.mapUserRaw(rawUser)
      this.cache(user)
      users[user.id] = user
    }

    return users
  }

  /**
   * Evicts everything cached for the user. Username keys are matched by the cached id rather than
   * by the name of the current id entry, so keys left behind by a rename are removed as well.
   */
  public clearCache(userId: number): UserCacheEviction {
    const byId = userId in this.cacheId
    delete this.cacheId[userId]

    const usernameKeys: string[] = []
    const keys = this.usernameKeysById.get(userId)
    if (keys) {
      for (const username of keys) {
        // a key can have been taken over by another user since (rename collisions); leave those alone
        if (this.cacheUsername[username] !== undefined && this.cacheUsername[username].id === userId) {
          usernameKeys.push(username)
          delete this.cacheUsername[username]
        }
      }
      this.usernameKeysById.delete(userId)
    }

    const publicKey = userId in this.cachedPublicKeys
    delete this.cachedPublicKeys[userId]
    const parent = userId in this.cachedUserParents
    delete this.cachedUserParents[userId]
    const stats = this.userStatsCache.delete(userId)

    return { byId, usernameKeys, publicKey, parent, stats }
  }

  /** Drops every cached user. The username suggestions trie is kept. Returns the sizes that were dropped. */
  public clearAll(): UserCacheStats {
    const stats = this.stats()
    this.cacheId = {}
    this.cacheUsername = {}
    this.usernameKeysById.clear()
    this.cachedUserParents = {}
    this.cachedPublicKeys = {}
    this.userStatsCache.clear()
    return stats
  }

  public stats(): UserCacheStats {
    return {
      byId: Object.keys(this.cacheId).length,
      byUsername: Object.keys(this.cacheUsername).length,
      parents: Object.keys(this.cachedUserParents).length,
      publicKeys: Object.keys(this.cachedPublicKeys).length,
      stats: this.userStatsCache.size,
      usernameSuggestions: this.usernamesSuggestionsCount,
    }
  }

  public inspect(userId: number): UserCacheInspection {
    const byId = this.cacheId[userId]
    const keys = this.usernameKeysById.get(userId)
    const usernameKeys = keys
      ? Array.from(keys).filter(
          (username) => this.cacheUsername[username] !== undefined && this.cacheUsername[username].id === userId,
        )
      : []
    const consistent = usernameKeys.every((username) => this.cacheUsername[username] === byId)
    return {
      byId,
      usernameKeys,
      consistent,
      publicKeyCached: userId in this.cachedPublicKeys,
      parentCached: userId in this.cachedUserParents,
      statsCached: this.userStatsCache.has(userId),
    }
  }

  private cache(user: UserInfo) {
    this.cacheId[user.id] = user
    this.cacheUsername[user.username] = user
    let keys = this.usernameKeysById.get(user.id)
    if (!keys) {
      keys = new Set()
      this.usernameKeysById.set(user.id, keys)
    }
    keys.add(user.username)
  }

  public async getByUsername(username: string): Promise<UserInfo | undefined> {
    if (this.cacheUsername[username]) {
      return this.cacheUsername[username]
    }

    const rawUser = await this.userRepository.getUserByUsername(username)

    if (!rawUser) {
      return
    }

    const user = this.mapUserRaw(rawUser)
    this.cache(user)
    return user
  }

  public async getUserParent(userId: number): Promise<UserInfo | undefined> {
    // check cache
    const cachedParent = this.cachedUserParents[userId]
    if (cachedParent === false) {
      return undefined
    } else if (typeof cachedParent === 'number') {
      return this.getById(cachedParent)
    }
    const parent = await this.userRepository.getUserParent(userId)
    this.cachedUserParents[userId] = parent ? parent.user_id : false
    return parent ? this.getById(parent.user_id) : undefined
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
      bio_html: rawUser.bio_html,
    }
  }

  getUserStatsCache(forUserId: number): UserStats | undefined {
    return this.userStatsCache.get(forUserId)
  }

  cacheUserStats(forUserId: number, stats: UserStats) {
    this.userStatsCache.set(forUserId, stats)
  }

  deleteUserStatsCache(forUserId: number) {
    this.userStatsCache.delete(forUserId)
  }

  clearUserStatsCache() {
    this.userStatsCache.clear()
  }

  getUsernameSuggestion(startsWith): { k: string; v: string }[] {
    return this.usernamesSuggestionsCache.search(startsWith.toLowerCase())
  }

  addUsernameSuggestion(username) {
    this.usernamesSuggestionsCount++
    return this.usernamesSuggestionsCache.add({ k: username.toLowerCase(), v: username })
  }

  clearPublicKeysCache(userId: number) {
    delete this.cachedPublicKeys[userId]
  }

  async getPublicKey(userId: number): Promise<string | undefined> {
    if (this.cachedPublicKeys[userId]) {
      return this.cachedPublicKeys[userId]
    }

    const publicKey = await this.userRepository.getPublicKey(userId)
    this.cachedPublicKeys[userId] = publicKey
    return publicKey
  }
}
