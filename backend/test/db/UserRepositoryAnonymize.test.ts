import UserRepository from '../../src/db/repositories/UserRepository'

describe('UserRepository.anonymizeAccount', () => {
  test('rewrites denormalized vote targets after locking content in the established edit order', async () => {
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

    // Search re-index: the user's own content and replies to their comments, before comments are reassigned
    expect(updated.find((q) => q.includes('update content_source set author_id'))).toContain('indexed = 0')
    const repliesIndex = updated.findIndex((q) => q.includes('parent.author_id = :user'))
    expect(updated[repliesIndex]).toContain('set cs.indexed = 0')

    const contentSourceIndex = updated.findIndex((query) => query.includes('update content_source'))
    const postsIndex = updated.findIndex((query) => query.includes('update posts set author_id'))
    const commentsIndex = updated.findIndex((query) => query.includes('update comments set author_id'))
    const postVotesIndex = updated.findIndex((query) => query.includes('update post_votes'))
    const commentVotesIndex = updated.findIndex((query) => query.includes('update comment_votes'))
    expect(contentSourceIndex).toBeLessThan(repliesIndex)
    expect(repliesIndex).toBeLessThan(postsIndex)
    expect(contentSourceIndex).toBeLessThan(postsIndex)
    expect(postsIndex).toBeLessThan(commentsIndex)
    expect(commentsIndex).toBeLessThan(postVotesIndex)
    expect(postVotesIndex).toBeLessThan(commentVotesIndex)

    for (const [query, params] of queries) {
      if (query.includes(':anon')) {
        expect(params).toEqual({ anon: 100, user: 7 })
      }
    }
    expect(db.inTransaction).toHaveBeenCalledTimes(1)
  })
})
