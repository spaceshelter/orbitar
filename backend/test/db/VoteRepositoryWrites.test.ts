import VoteRepository from '../../src/db/repositories/VoteRepository'

const normalize = (query: string) => query.replace(/\s+/g, ' ').trim()

const contentVoteDb = (
  existingVote: { vote: string; target_user_id: string | null } | undefined,
  entity = { site_id: '1', author_id: '2', rating: '5' },
) => {
  const operations: string[] = []
  const connection = {
    fetchOne: jest.fn((query: string) => {
      operations.push(normalize(query))
      return Promise.resolve(query.includes('from posts') ? entity : existingVote)
    }),
    query: jest.fn((query: string, _params?: Record<string, unknown>) => {
      operations.push(normalize(query))
      return Promise.resolve()
    }),
  }
  const db = {
    inTransaction: jest.fn((callback) => callback(connection)),
  }

  return { connection, db, operations, repository: new VoteRepository(db as any) }
}

describe('VoteRepository content writes', () => {
  test('a repeated vote with the current target is a two-query no-op', async () => {
    const { connection, db, operations, repository } = contentVoteDb({ vote: '1', target_user_id: '2' })

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(5)

    expect(operations).toHaveLength(2)
    expect(operations[0]).toContain('from posts where post_id = :entity_id FOR UPDATE')
    expect(operations[1]).toContain(
      'select vote, target_user_id from post_votes where post_id = :entity_id and voter_id = :voter_id FOR UPDATE',
    )
    expect(connection.query).not.toHaveBeenCalled()
    expect(db.inTransaction).toHaveBeenCalledTimes(1)
  })

  test('a repeated vote repairs only a stale denormalized target', async () => {
    const { connection, repository } = contentVoteDb({ vote: '1', target_user_id: '99' })

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(5)

    expect(connection.query).toHaveBeenCalledTimes(1)
    const [query, params] = connection.query.mock.calls[0]
    expect(normalize(query)).toContain(
      'update post_votes set target_user_id = :target_user_id where post_id = :entity_id and voter_id = :voter_id',
    )
    expect(query).not.toContain('voted_at')
    expect(params).toEqual({ entity_id: 10, voter_id: 123, target_user_id: 2 })
  })

  test('a changed vote updates the vote and all ratings with six ordered statements', async () => {
    const { connection, operations, repository } = contentVoteDb({ vote: '-1', target_user_id: '2' })

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(7)

    expect(operations).toHaveLength(6)
    expect(operations[0]).toContain('from posts where post_id = :entity_id FOR UPDATE')
    expect(operations[1]).toContain('from post_votes')
    expect(operations[2]).toContain(
      'update post_votes set vote = :vote, target_user_id = :target_user_id, voted_at = now()',
    )
    expect(operations[3]).toContain('update posts set rating=rating + :delta')
    expect(operations[4]).toContain(
      'insert into user_site_rating (user_id, site_id, post_rating) values (:user_id, :site_id, :delta) on duplicate key update post_rating = post_rating + :delta',
    )
    expect(operations[5]).toContain(
      'insert into user_user_rating (user_id, voter_id, post_rating) values (:user_id, :voter_id, :delta) on duplicate key update post_rating = post_rating + :delta',
    )
    expect(operations.join('\n')).not.toContain('select post_rating from user_')
    expect(connection.query.mock.calls.slice(1).map(([, params]) => params)).toEqual([
      { entity_id: 10, delta: 2 },
      { user_id: 2, site_id: 1, delta: 2 },
      { user_id: 2, voter_id: 123, delta: 2 },
    ])
  })

  test('a missing zero vote is still persisted without touching ratings', async () => {
    const { connection, repository } = contentVoteDb(undefined)

    await expect(repository.postSetVote(10, 0, 123)).resolves.toBe(5)

    expect(connection.query).toHaveBeenCalledTimes(1)
    const [query, params] = connection.query.mock.calls[0]
    expect(normalize(query)).toContain(
      'insert into post_votes ( post_id, voter_id, vote, target_user_id ) values ( :entity_id, :voter_id, :vote, :target_user_id )',
    )
    expect(params).toEqual({ entity_id: 10, voter_id: 123, vote: 0, target_user_id: 2 })
  })

  test('comment votes update comment-specific aggregate columns', async () => {
    const operations: string[] = []
    const connection = {
      fetchOne: jest.fn((query: string) => {
        operations.push(normalize(query))
        return Promise.resolve(
          query.includes('from comments')
            ? { site_id: '1', author_id: '2', rating: '5' }
            : { vote: '0', target_user_id: '2' },
        )
      }),
      query: jest.fn((query: string, _params?: Record<string, unknown>) => {
        operations.push(normalize(query))
        return Promise.resolve()
      }),
    }
    const db = { inTransaction: jest.fn((callback) => callback(connection)) }
    const repository = new VoteRepository(db as any)

    await expect(repository.commentSetVote(10, -1, 123)).resolves.toBe(4)

    expect(operations.join('\n')).toContain('comment_rating = comment_rating + :delta')
    expect(operations.join('\n')).not.toContain('post_rating = post_rating + :delta')
  })
})

describe('VoteRepository user karma writes', () => {
  test('locks the unique users in ascending order before reading the vote row', async () => {
    const operations: string[] = []
    const connection = {
      fetchAll: jest.fn((query: string, _params?: Record<string, unknown>) => {
        operations.push(normalize(query))
        return Promise.resolve([
          { user_id: '30', karma: '5' },
          { user_id: '123', karma: '0' },
        ])
      }),
      fetchOne: jest.fn((query: string) => {
        operations.push(normalize(query))
        return Promise.resolve({ vote: '-2' })
      }),
      query: jest.fn((query: string, _params?: Record<string, unknown>) => {
        operations.push(normalize(query))
        return Promise.resolve()
      }),
    }
    const db = { inTransaction: jest.fn((callback) => callback(connection)) }
    const repository = new VoteRepository(db as any)

    await expect(repository.userSetVote(30, 2, 123)).resolves.toBe(9)

    expect(operations[0]).toContain('where user_id in (:user_ids) order by user_id for update')
    expect(connection.fetchAll.mock.calls[0][1]).toEqual({ user_ids: [30, 123] })
    expect(operations[1]).toContain(
      'select vote from user_karma where user_id = :user_id and voter_id = :voter_id for update',
    )
    expect(operations[2]).toContain('update user_karma set vote = :vote, voted_at = now()')
    expect(operations[3]).toContain('update users set karma = karma + :delta')
    expect(connection.query.mock.calls[1][1]).toEqual({ delta: 4, user_id: 30 })
    expect(operations.join('\n')).not.toContain('sum(vote)')
  })

  test('a repeated user vote is a two-query no-op and preserves voted_at', async () => {
    const connection = {
      fetchAll: jest.fn().mockResolvedValue([
        { user_id: '30', karma: '5' },
        { user_id: '123', karma: '0' },
      ]),
      fetchOne: jest.fn().mockResolvedValue({ vote: '2' }),
      query: jest.fn().mockResolvedValue(undefined),
    }
    const db = { inTransaction: jest.fn((callback) => callback(connection)) }
    const repository = new VoteRepository(db as any)

    await expect(repository.userSetVote(30, 2, 123)).resolves.toBe(5)

    expect(connection.fetchAll).toHaveBeenCalledTimes(1)
    expect(connection.fetchOne).toHaveBeenCalledTimes(1)
    expect(connection.query).not.toHaveBeenCalled()
  })

  test('a missing zero user vote is persisted without changing karma', async () => {
    const connection = {
      fetchAll: jest.fn().mockResolvedValue([
        { user_id: '30', karma: '5' },
        { user_id: '123', karma: '0' },
      ]),
      fetchOne: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
    }
    const db = { inTransaction: jest.fn((callback) => callback(connection)) }
    const repository = new VoteRepository(db as any)

    await expect(repository.userSetVote(30, 0, 123)).resolves.toBe(5)

    expect(connection.query).toHaveBeenCalledTimes(1)
    const [query, params] = connection.query.mock.calls[0]
    expect(normalize(query)).toContain(
      'insert into user_karma (user_id, voter_id, vote) values (:user_id, :voter_id, :vote)',
    )
    expect(params).toEqual({ user_id: 30, voter_id: 123, vote: 0 })
  })

  test('a self-vote locks its user row only once', async () => {
    const connection = {
      fetchAll: jest.fn().mockResolvedValue([{ user_id: '30', karma: '5' }]),
      fetchOne: jest.fn().mockResolvedValue({ vote: '1' }),
      query: jest.fn().mockResolvedValue(undefined),
    }
    const db = { inTransaction: jest.fn((callback) => callback(connection)) }
    const repository = new VoteRepository(db as any)

    await expect(repository.userSetVote(30, 1, 30)).resolves.toBe(5)

    expect(connection.fetchAll.mock.calls[0][1]).toEqual({ user_ids: [30] })
  })
})

class Mutex {
  private tail = Promise.resolve()

  async acquire(): Promise<() => void> {
    let release: () => void = () => undefined
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const previous = this.tail
    this.tail = this.tail.then(() => current)
    await previous
    return release
  }
}

class ConcurrentUserVoteDb {
  readonly users = new Map<number, number>()
  readonly votes = new Map<string, number>()
  readonly lockRequests: number[][] = []
  private readonly locks = new Map<number, Mutex>()

  constructor(userIds: number[]) {
    userIds.forEach((userId) => this.users.set(userId, 0))
  }

  async inTransaction<T>(callback: (connection: object) => Promise<T>): Promise<T> {
    const releases: Array<() => void> = []
    const connection = {
      fetchAll: async (_query: string, params: { user_ids: number[] }) => {
        this.lockRequests.push([...params.user_ids])
        for (const userId of params.user_ids) {
          let lock = this.locks.get(userId)
          if (!lock) {
            lock = new Mutex()
            this.locks.set(userId, lock)
          }
          releases.push(await lock.acquire())
        }
        return params.user_ids.map((userId) => ({
          user_id: String(userId),
          karma: String(this.users.get(userId)),
        }))
      },
      fetchOne: async (_query: string, params: { user_id: number; voter_id: number }) => {
        const vote = this.votes.get(`${params.user_id}:${params.voter_id}`)
        return vote == null ? undefined : { vote: String(vote) }
      },
      query: async (query: string, params: { user_id: number; voter_id?: number; vote?: number; delta?: number }) => {
        if (query.includes('user_karma')) {
          this.votes.set(`${params.user_id}:${params.voter_id}`, params.vote!)
        } else if (query.includes('update users')) {
          this.users.set(params.user_id, this.users.get(params.user_id)! + params.delta!)
        }
      },
    }

    try {
      return await callback(connection)
    } finally {
      releases.reverse().forEach((release) => release())
    }
  }
}

describe('VoteRepository concurrent user karma writes', () => {
  test('simultaneous voters apply both deltas to the same target', async () => {
    const db = new ConcurrentUserVoteDb([10, 20, 21])
    const repository = new VoteRepository(db as any)

    const ratings = await Promise.all([repository.userSetVote(10, 1, 20), repository.userSetVote(10, 1, 21)])

    expect(ratings.sort()).toEqual([1, 2])
    expect(db.users.get(10)).toBe(2)
    expect(db.votes.get('10:20')).toBe(1)
    expect(db.votes.get('10:21')).toBe(1)
  })

  test('reciprocal votes request the same ascending lock order', async () => {
    const db = new ConcurrentUserVoteDb([1, 2])
    const repository = new VoteRepository(db as any)

    await Promise.all([repository.userSetVote(2, 1, 1), repository.userSetVote(1, 1, 2)])

    expect(db.lockRequests).toEqual([
      [1, 2],
      [1, 2],
    ])
    expect(db.users.get(1)).toBe(1)
    expect(db.users.get(2)).toBe(1)
  })
})

describe('VoteRepository deadlock retry', () => {
  const deadlockError = () => Object.assign(new Error('Deadlock found when trying to get lock'), { errno: 1213 })

  test('retries a deadlocked vote transaction once and returns the retry result', async () => {
    const inTransaction = jest.fn().mockRejectedValueOnce(deadlockError()).mockResolvedValueOnce(7)
    const repository = new VoteRepository({ inTransaction } as any)

    await expect(repository.userSetVote(2, 1, 5)).resolves.toBe(7)
    expect(inTransaction).toHaveBeenCalledTimes(2)
  })

  test('gives up after the retry budget instead of spinning on persistent deadlocks', async () => {
    const error = deadlockError()
    const inTransaction = jest.fn().mockRejectedValue(error)
    const repository = new VoteRepository({ inTransaction } as any)

    await expect(repository.postSetVote(10, 1, 123)).rejects.toBe(error)
    expect(inTransaction).toHaveBeenCalledTimes(2)
  })

  test('rethrows non-deadlock errors without retrying', async () => {
    const error = Object.assign(new Error('db down'), { errno: 1045 })
    const inTransaction = jest.fn().mockRejectedValue(error)
    const repository = new VoteRepository({ inTransaction } as any)

    await expect(repository.commentSetVote(20, -1, 123)).rejects.toBe(error)
    expect(inTransaction).toHaveBeenCalledTimes(1)
  })
})
