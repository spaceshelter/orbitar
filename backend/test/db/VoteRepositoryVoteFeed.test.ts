import VoteRepository, { VoteFeedCursor } from '../../src/db/repositories/VoteRepository'

const normalize = (query: string) => query.replace(/\s+/g, ' ').trim()

describe('VoteRepository vote feed', () => {
  test('mine direction queries all three branches by voter with deterministic order and per-branch limits', async () => {
    const db = {
      fetchAll: jest.fn().mockResolvedValue([
        {
          type: 'post',
          entityId: 10,
          postId: 10,
          voterId: 123,
          targetUserId: 201,
          vote: 1,
          votedAt: new Date('2026-05-11T10:00:00.000Z'),
        },
      ]),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.getVoteFeedEvents(123, 'mine', 'orbitar', undefined, 21)).resolves.toEqual([
      {
        type: 'post',
        entityId: 10,
        postId: 10,
        voterId: 123,
        targetUserId: 201,
        vote: 1,
        votedAt: new Date('2026-05-11T10:00:00.000Z'),
      },
    ])

    const [query, params] = db.fetchAll.mock.calls[0]
    const sql = normalize(query)
    expect(sql).toMatchSnapshot()
    expect(sql).toContain('union all')
    expect(sql).toContain('pv.voter_id = :user_id')
    expect(sql).toContain('cv.voter_id = :user_id')
    expect(sql).toContain('uk.voter_id = :user_id')
    expect(sql).toContain('force index (idx_post_votes_voter_voted_at)')
    expect(sql).toContain('force index (idx_comment_votes_voter_voted_at)')
    expect(sql).toContain('force index (idx_user_karma_voter_voted_at)')
    expect(sql).toContain('and c.deleted = 0')
    expect(sql).toContain('order by pv.voted_at desc, pv.post_id desc, pv.voter_id desc limit :branch_limit')
    expect(sql).toContain('order by cv.voted_at desc, cv.comment_id desc, cv.voter_id desc limit :branch_limit')
    expect(sql).toContain('order by uk.voted_at desc, uk.user_id desc, uk.voter_id desc limit :branch_limit')
    expect(sql).toContain('order by votedAt desc, type desc, entityId desc, voterId desc limit :limit_count')
    // filter matches content and the other party of the vote
    expect(sql).toContain('join users fu on (fu.user_id = pv.target_user_id)')
    expect(sql).toContain('join users fu on (fu.user_id = cv.target_user_id)')
    expect(sql).toContain('join users fu on (fu.user_id = uk.user_id)')
    expect(sql).toContain('p.source like :filter or p.title like :filter')
    expect(sql).toContain('c.source like :filter')
    expect(params).toEqual({
      user_id: 123,
      filter: '%orbitar%',
      branch_limit: 21,
      limit_count: 21,
    })
  })

  test('received direction uses denormalized target ids and no joins without filter', async () => {
    const db = {
      fetchAll: jest.fn().mockResolvedValue([]),
    }
    const repository = new VoteRepository(db as any)

    await repository.getVoteFeedEvents(123, 'received', '', undefined, 21)

    const [query, params] = db.fetchAll.mock.calls[0]
    const sql = normalize(query)
    expect(sql).toMatchSnapshot()
    expect(sql).toContain('pv.target_user_id = :user_id')
    expect(sql).toContain('cv.target_user_id = :user_id')
    expect(sql).toContain('uk.user_id = :user_id')
    expect(sql).toContain('force index (idx_post_votes_target_voted_at)')
    expect(sql).toContain('force index (idx_comment_votes_target_voted_at)')
    expect(sql).toContain('force index (idx_user_karma_user_voted_at)')
    expect(sql).not.toContain('join posts')
    expect(sql).not.toContain('join users')
    expect(sql).toContain('join comments c on (c.comment_id = cv.comment_id)')
    expect(sql).toContain('and c.deleted = 0')
    expect(sql).not.toContain('pv.voter_id != :user_id')
    expect(params).toEqual({
      user_id: 123,
      branch_limit: 21,
      limit_count: 21,
    })
  })

  test('cursor predicate is simplified per branch against the cursor type', async () => {
    const db = {
      fetchAll: jest.fn().mockResolvedValue([]),
    }
    const repository = new VoteRepository(db as any)
    const cursor: VoteFeedCursor = {
      votedAt: new Date('2026-05-01T12:00:00.000Z'),
      type: 'comment',
      entityId: 555,
      voterId: 42,
    }

    await repository.getVoteFeedEvents(123, 'mine', '', cursor, 21)

    const [query, params] = db.fetchAll.mock.calls[0]
    const sql = normalize(query)
    // 'post' > 'comment': only strictly older timestamps qualify
    expect(sql).toContain('and pv.voted_at < :cursor_voted_at')
    expect(sql).not.toContain('pv.voted_at <= :cursor_voted_at')
    // 'user' > 'comment': same
    expect(sql).toContain('and uk.voted_at < :cursor_voted_at')
    // same type: full tiebreaker comparison
    expect(sql).toContain(
      'and (cv.voted_at < :cursor_voted_at or (cv.voted_at = :cursor_voted_at and ' +
        '(cv.comment_id < :cursor_entity_id or ' +
        '(cv.comment_id = :cursor_entity_id and cv.voter_id < :cursor_voter_id))))',
    )
    expect(params).toMatchObject({
      cursor_voted_at: cursor.votedAt,
      cursor_entity_id: 555,
      cursor_voter_id: 42,
    })
  })

  test('cursor predicate allows same-timestamp rows for branches sorting after the cursor type', async () => {
    const db = {
      fetchAll: jest.fn().mockResolvedValue([]),
    }
    const repository = new VoteRepository(db as any)
    const cursor: VoteFeedCursor = {
      votedAt: new Date('2026-05-01T12:00:00.000Z'),
      type: 'user',
      entityId: 7,
      voterId: 42,
    }

    await repository.getVoteFeedEvents(123, 'received', '', cursor, 21)

    const sql = normalize(db.fetchAll.mock.calls[0][0])
    // 'post' < 'user' and 'comment' < 'user': ties on votedAt stay reachable
    expect(sql).toContain('and pv.voted_at <= :cursor_voted_at')
    expect(sql).toContain('and cv.voted_at <= :cursor_voted_at')
    expect(sql).toContain(
      'and (uk.voted_at < :cursor_voted_at or (uk.voted_at = :cursor_voted_at and ' +
        '(uk.user_id < :cursor_entity_id or (uk.user_id = :cursor_entity_id and uk.voter_id < :cursor_voter_id))))',
    )
  })

  test('content vote locks the entity before synchronizing its denormalized target in the transaction', async () => {
    const operations: Array<[string, Record<string, unknown> | undefined]> = []
    const connection = {
      fetchOne: jest.fn((query: string, params: Record<string, unknown>) => {
        operations.push([query, params])
        if (query.includes('from posts')) {
          return Promise.resolve({ site_id: '1', author_id: '2', rating: '5' })
        }
        return Promise.resolve({ vote: '0' })
      }),
      query: jest.fn((query: string, params?: Record<string, unknown>) => {
        operations.push([query, params])
        return Promise.resolve()
      }),
    }
    const db = {
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(6)

    const entityLockIndex = operations.findIndex(([query]) => query.includes('from posts'))
    const voteInsertIndex = operations.findIndex(([query]) => query.includes('into post_votes'))
    const voteReadIndex = operations.findIndex(([query]) => query.includes('from post_votes'))
    expect(entityLockIndex).toBe(0)
    expect(voteInsertIndex).toBeGreaterThan(entityLockIndex)
    expect(voteReadIndex).toBeGreaterThan(voteInsertIndex)
    expect(normalize(operations[entityLockIndex][0])).toContain(
      'select site_id, author_id, rating from posts where post_id = :entity_id FOR UPDATE',
    )

    const voteInsert = operations[voteInsertIndex]
    expect(voteInsert).toBeDefined()
    expect(voteInsert![0]).toContain('target_user_id')
    expect(normalize(voteInsert![0])).toContain('on duplicate key update target_user_id = :target_user_id')
    expect(voteInsert![1]).toMatchObject({ entity_id: 10, voter_id: 123, target_user_id: 2 })
    expect(db.inTransaction).toHaveBeenCalledTimes(1)
  })

  test('changing a content vote updates voted_at', async () => {
    const updates: string[] = []
    const connection = {
      fetchOne: jest
        .fn()
        .mockResolvedValueOnce({ site_id: '1', author_id: '2', rating: '5' })
        .mockResolvedValueOnce({ vote: '0' }),
      query: jest.fn((query: string) => {
        updates.push(query)
        return Promise.resolve()
      }),
    }
    const db = {
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(6)

    expect(updates.join('\n')).toContain('voted_at=now()')
  })

  test('repeating the same content vote does not update voted_at', async () => {
    const connection = {
      fetchOne: jest
        .fn()
        .mockResolvedValueOnce({ site_id: '1', author_id: '2', rating: '5' })
        .mockResolvedValueOnce({ vote: '1' }),
      query: jest.fn().mockResolvedValue(undefined),
    }
    const db = {
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(5)

    const queries = connection.query.mock.calls.map(([query]) => normalize(query))
    expect(queries).toHaveLength(3)
    expect(queries[0]).toContain('on duplicate key update target_user_id = :target_user_id')
    expect(queries.join('\n')).not.toContain('set vote=:vote')
    expect(queries.join('\n')).not.toContain('voted_at=now()')
  })

  test('user votes update voted_at only when the vote value changes', async () => {
    const connection = {
      fetchOne: jest.fn().mockResolvedValue({ rating: '5' }),
      query: jest.fn().mockResolvedValue(undefined),
    }
    const db = {
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.userSetVote(30, 2, 123)).resolves.toBe(5)

    const [query] = connection.query.mock.calls[0]
    expect(query).toContain('voted_at = if(vote <> :vote, now(), voted_at)')
    expect(query).not.toContain('values(vote)')
  })
})
