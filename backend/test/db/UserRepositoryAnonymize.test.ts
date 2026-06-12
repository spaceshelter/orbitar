import UserRepository from '../../src/db/repositories/UserRepository'

describe('UserRepository.anonymizeAccount', () => {
  test('rewrites denormalized vote targets together with content authorship', async () => {
    const queries: Array<[string, Record<string, unknown>]> = []
    const connection = {
      query: jest.fn((query: string, params: Record<string, unknown>) => {
        queries.push([query, params])
        return Promise.resolve()
      }),
    }
    const db = {
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new UserRepository(db as any)

    await repository.anonymizeAccount(7, 100)

    const updated = queries.map(([query]) => query)
    expect(updated.find((q) => q.includes('post_votes'))).toContain('target_user_id = :anon')
    expect(updated.find((q) => q.includes('comment_votes'))).toContain('target_user_id = :anon')
    expect(updated.find((q) => q.includes('update posts set author_id'))).toBeDefined()
    expect(updated.find((q) => q.includes('update comments set author_id'))).toBeDefined()

    for (const [query, params] of queries) {
      if (query.includes(':anon')) {
        expect(params).toEqual({ anon: 100, user: 7 })
      }
    }
    expect(db.inTransaction).toHaveBeenCalledTimes(1)
  })
})
