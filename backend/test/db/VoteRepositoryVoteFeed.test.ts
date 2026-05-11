import VoteRepository from '../../src/db/repositories/VoteRepository'

describe('VoteRepository vote feed', () => {
  test('getVoteFeedEvents selects current user outgoing non-zero votes', async () => {
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

    await expect(repository.getVoteFeedEvents(123, 'mine', 'orbitar', 2, 20)).resolves.toEqual([
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
    expect(query).toContain('union all')
    expect(query).toContain('pv.voter_id = :user_id')
    expect(query).toContain('cv.voter_id = :user_id')
    expect(query).toContain('uk.voter_id = :user_id')
    expect(query).toContain('pv.vote != 0')
    expect(query).toContain('cv.vote != 0')
    expect(query).toContain('uk.vote != 0')
    expect(query).toContain('order by votedAt desc')
    expect(params).toEqual({
      user_id: 123,
      filter: '%orbitar%',
      limit_from: 20,
      limit_count: 20,
    })
  })

  test('getVoteFeedEvents selects current user incoming non-zero votes including self votes', async () => {
    const db = {
      fetchAll: jest.fn().mockResolvedValue([]),
    }
    const repository = new VoteRepository(db as any)

    await repository.getVoteFeedEvents(123, 'received', '', 1, 20)

    const [query, params] = db.fetchAll.mock.calls[0]
    expect(query).toContain('p.author_id = :user_id')
    expect(query).toContain('c.author_id = :user_id')
    expect(query).toContain('uk.user_id = :user_id')
    expect(query).not.toContain('pv.voter_id != :user_id')
    expect(query).not.toContain('cv.voter_id != :user_id')
    expect(query).not.toContain('uk.voter_id != :user_id')
    expect(params).toEqual({
      user_id: 123,
      limit_from: 0,
      limit_count: 20,
    })
  })

  test('getVoteFeedTotal counts raw vote events for the chosen direction', async () => {
    const db = {
      fetchOne: jest.fn().mockResolvedValue({ count: 7 }),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.getVoteFeedTotal(123, 'received', 'text')).resolves.toBe(7)

    const [query, params] = db.fetchOne.mock.calls[0]
    expect(query).toContain('select count(*) count')
    expect(query).toContain('union all')
    expect(params).toEqual({ user_id: 123, filter: '%text%' })
  })

  test('changing a content vote updates voted_at', async () => {
    const updates: string[] = []
    const connection = {
      fetchOne: jest.fn().mockResolvedValueOnce({ rating: '5' }).mockResolvedValueOnce({ vote: '0' }),
      query: jest.fn((query: string) => {
        updates.push(query)
        return Promise.resolve()
      }),
    }
    const db = {
      fetchOne: jest.fn().mockResolvedValue({ site_id: '1', author_id: '2' }),
      query: jest.fn().mockResolvedValue(undefined),
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(6)

    expect(updates.join('\n')).toContain('voted_at=now()')
  })

  test('repeating the same content vote does not update voted_at', async () => {
    const connection = {
      fetchOne: jest.fn().mockResolvedValueOnce({ rating: '5' }).mockResolvedValueOnce({ vote: '1' }),
      query: jest.fn().mockResolvedValue(undefined),
    }
    const db = {
      fetchOne: jest.fn().mockResolvedValue({ site_id: '1', author_id: '2' }),
      query: jest.fn().mockResolvedValue(undefined),
      inTransaction: jest.fn((callback) => callback(connection)),
    }
    const repository = new VoteRepository(db as any)

    await expect(repository.postSetVote(10, 1, 123)).resolves.toBe(5)

    expect(connection.query).not.toHaveBeenCalled()
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
    expect(query).toContain('voted_at = if(vote <> values(vote), now(), voted_at)')
  })
})
