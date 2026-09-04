import UserRepository from '../../src/db/repositories/UserRepository'
import { UserRaw } from '../../src/db/types/UserRaw'
import { UserCache } from '../../src/managers/UserCache'

function raw(userId: number, username: string): UserRaw {
  return { user_id: userId, username, gender: 0, karma: 0, name: username, ontrial: 0 } as unknown as UserRaw
}

function makeRepository(usernames: string[]) {
  return {
    getUserCount: jest.fn(async () => usernames.length),
    getUsernames: jest.fn(async () => usernames.map((username) => ({ username }))),
    getLastActiveUsers: jest.fn(async () => []),
    getUserById: jest.fn(),
    getUserByUsername: jest.fn(),
    getUsersByIds: jest.fn(async () => []),
  }
}

describe('UserCache eviction', () => {
  test('clearCache removes username keys orphaned by a rename', async () => {
    const repository = makeRepository(['Dobrokot'])
    const cache = new UserCache(repository as unknown as UserRepository)

    repository.getUserByUsername.mockResolvedValueOnce(raw(1625, 'Dobrokot'))
    await cache.getByUsername('Dobrokot')
    // the DB row is renamed; a lookup by the new name replaces the id entry but leaves the old key behind
    repository.getUserByUsername.mockResolvedValueOnce(raw(1625, 'Stervo'))
    await cache.getByUsername('Stervo')

    const before = cache.inspect(1625)
    expect(before.usernameKeys.sort()).toEqual(['Dobrokot', 'Stervo'])
    expect(before.consistent).toBe(false)

    const eviction = cache.clearCache(1625)
    expect(eviction.byId).toBe(true)
    expect(eviction.usernameKeys.sort()).toEqual(['Dobrokot', 'Stervo'])

    repository.getUserByUsername.mockResolvedValueOnce(undefined)
    await expect(cache.getByUsername('Dobrokot')).resolves.toBeUndefined()
    expect(cache.stats()).toMatchObject({ byId: 0, byUsername: 0 })
  })

  test('clearAll drops everything and reports what was there', async () => {
    const repository = makeRepository([])
    const cache = new UserCache(repository as unknown as UserRepository)
    repository.getUserByUsername.mockResolvedValueOnce(raw(1, 'a')).mockResolvedValueOnce(raw(2, 'b'))
    await cache.getByUsername('a')
    await cache.getByUsername('b')
    cache.cacheUserStats(1, { notifications: 0, watch: { posts: 0, comments: 0 } } as never)

    expect(cache.clearAll()).toMatchObject({ byId: 2, byUsername: 2, stats: 1 })
    expect(cache.stats()).toMatchObject({ byId: 0, byUsername: 0, stats: 0 })
  })
})

describe('UserCache username suggestions', () => {
  test('rebuild replaces the trie instead of growing it', async () => {
    const repository = makeRepository(['Dobrokot', 'Aivean'])
    const cache = new UserCache(repository as unknown as UserRepository)
    await expect(cache.rebuildUsernameSuggestions()).resolves.toBe(2)
    expect(cache.getUsernameSuggestion('dob').map((entry) => entry.v)).toEqual(['Dobrokot'])

    repository.getUsernames.mockResolvedValue([{ username: 'Stervo' }, { username: 'Aivean' }])
    await expect(cache.rebuildUsernameSuggestions()).resolves.toBe(2)
    expect(cache.getUsernameSuggestion('dob')).toEqual([])
    expect(cache.getUsernameSuggestion('ste').map((entry) => entry.v)).toEqual(['Stervo'])
    expect(cache.stats().usernameSuggestions).toBe(2)
  })

  test('registration keeps adding to the current trie', async () => {
    const repository = makeRepository([])
    const cache = new UserCache(repository as unknown as UserRepository)
    await cache.rebuildUsernameSuggestions()
    cache.addUsernameSuggestion('Newcomer')
    expect(cache.getUsernameSuggestion('new').map((entry) => entry.v)).toEqual(['Newcomer'])
    expect(cache.stats().usernameSuggestions).toBe(1)
  })
})
