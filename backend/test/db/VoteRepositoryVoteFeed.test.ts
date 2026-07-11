import VoteFeedReadRepository, { VoteFeedCursor } from '../../src/db/repositories/VoteFeedReadRepository'

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
    const repository = new VoteFeedReadRepository(db as any)

    await expect(repository.getPageReferences(123, 'mine', 'orbitar', undefined, 21)).resolves.toEqual([
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
    const repository = new VoteFeedReadRepository(db as any)

    await repository.getPageReferences(123, 'received', '', undefined, 21)

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
    const repository = new VoteFeedReadRepository(db as any)
    const cursor: VoteFeedCursor = {
      votedAt: new Date('2026-05-01T12:00:00.000Z'),
      type: 'comment',
      entityId: 555,
      voterId: 42,
    }

    await repository.getPageReferences(123, 'mine', '', cursor, 21)

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
    const repository = new VoteFeedReadRepository(db as any)
    const cursor: VoteFeedCursor = {
      votedAt: new Date('2026-05-01T12:00:00.000Z'),
      type: 'user',
      entityId: 7,
      voterId: 42,
    }

    await repository.getPageReferences(123, 'received', '', cursor, 21)

    const sql = normalize(db.fetchAll.mock.calls[0][0])
    // 'post' < 'user' and 'comment' < 'user': ties on votedAt stay reachable
    expect(sql).toContain('and pv.voted_at <= :cursor_voted_at')
    expect(sql).toContain('and cv.voted_at <= :cursor_voted_at')
    expect(sql).toContain(
      'and (uk.voted_at < :cursor_voted_at or (uk.voted_at = :cursor_voted_at and ' +
        '(uk.user_id < :cursor_entity_id or (uk.user_id = :cursor_entity_id and uk.voter_id < :cursor_voter_id))))',
    )
  })

  test('received hydration selects one compact projection per unique subject', async () => {
    const db = {
      fetchAll: jest.fn((query: string) => {
        if (query.includes('from posts p')) {
          return Promise.resolve([{ id: 10, site: 'main', title: 'Post', html: '<p>Post</p>', rating: 5 }])
        }
        return Promise.resolve([{ id: 20, postId: 10, site: 'main', postTitle: 'Post', rating: 3 }])
      }),
    }
    const repository = new VoteFeedReadRepository(db as any)

    await expect(repository.getReceivedPostSubjects([10, 10])).resolves.toHaveLength(1)
    await expect(repository.getReceivedCommentSubjects([20, 20])).resolves.toHaveLength(1)

    const postSql = normalize(db.fetchAll.mock.calls[0][0])
    expect(postSql).toContain("if(nullif(trim(p.title), '') is null, p.html, '') html")
    expect(postSql).not.toContain('p.source')
    expect(postSql).not.toContain('p.author_id')

    const commentSql = normalize(db.fetchAll.mock.calls[1][0])
    expect(commentSql).toContain(
      'select c.comment_id id, c.post_id postId, s.subdomain site, p.title postTitle, c.rating',
    )
    expect(commentSql).not.toContain('c.source')
    expect(commentSql).not.toContain('c.html')
    expect(commentSql).not.toContain('c.author_id')
  })

  test('skips compact hydration queries for empty pages', async () => {
    const db = { fetchAll: jest.fn() }
    const repository = new VoteFeedReadRepository(db as any)

    await expect(repository.getReceivedPostSubjects([])).resolves.toEqual([])
    await expect(repository.getReceivedCommentSubjects([])).resolves.toEqual([])
    expect(db.fetchAll).not.toHaveBeenCalled()
  })
})
