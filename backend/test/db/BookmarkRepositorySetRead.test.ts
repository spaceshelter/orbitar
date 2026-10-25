import BookmarkRepository from '../../src/db/repositories/BookmarkRepository'

const normalize = (query: string) => query.replace(/\s+/g, ' ').trim()

const bookmarkDb = (existing: { last_read_comment_id: number; read_comments: number } | undefined, readCount = 7) => {
  const operations: string[] = []
  const connection = {
    fetchOne: jest.fn((query: string) => {
      operations.push(normalize(query))
      return Promise.resolve(query.includes('from user_bookmarks') ? existing : { cnt: String(readCount) })
    }),
    query: jest.fn((query: string, _params?: Record<string, unknown>) => {
      operations.push(normalize(query))
      return Promise.resolve()
    }),
  }
  const db = {
    inTransaction: jest.fn((callback) => callback(connection)),
  }

  return { connection, operations, repository: new BookmarkRepository(db as any) }
}

describe('BookmarkRepository.setRead', () => {
  test('a first read merges on the primary key instead of failing when a concurrent request inserted first', async () => {
    const { connection, repository } = bookmarkDb(undefined)

    await expect(repository.setRead(10, 123, 5, 900)).resolves.toBe(true)

    expect(connection.query).toHaveBeenCalledTimes(1)
    const [query, params] = connection.query.mock.calls[0]
    expect(normalize(query)).toBe(
      'insert into user_bookmarks (post_id, user_id, read_comments, last_read_comment_id)' +
        ' values (:post_id, :user_id, :read_comments, :last_read_comment_id)' +
        ' on duplicate key update read_comments = greatest(read_comments, values(read_comments)),' +
        ' last_read_comment_id = greatest(coalesce(last_read_comment_id, 0), values(last_read_comment_id))',
    )
    expect(params).toEqual({ post_id: 10, user_id: 123, read_comments: 7, last_read_comment_id: 900 })
  })

  test('an existing row only moves forward, so a request that lost the race cannot roll progress back', async () => {
    const { connection, repository } = bookmarkDb({ last_read_comment_id: 800, read_comments: 3 })

    await expect(repository.setRead(10, 123, 5, 900)).resolves.toBe(true)

    expect(connection.query).toHaveBeenCalledTimes(1)
    const [query, params] = connection.query.mock.calls[0]
    expect(normalize(query)).toBe(
      'update user_bookmarks set read_comments = greatest(read_comments, :read_comments),' +
        ' last_read_comment_id = greatest(coalesce(last_read_comment_id, 0), :last_read_comment_id)' +
        ' where user_id=:user_id and post_id=:post_id',
    )
    expect(params).toEqual({ post_id: 10, user_id: 123, read_comments: 7, last_read_comment_id: 900 })
  })

  test('a request older than the stored progress writes nothing', async () => {
    const { connection, operations, repository } = bookmarkDb({ last_read_comment_id: 900, read_comments: 3 })

    await expect(repository.setRead(10, 123, 5, 900)).resolves.toBe(false)

    expect(operations).toHaveLength(1)
    expect(connection.query).not.toHaveBeenCalled()
  })
})
