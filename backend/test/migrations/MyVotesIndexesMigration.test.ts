import migration from '../../migrations/20260712000000-my-votes-indexes'

const normalize = (query: string) => query.replace(/\s+/g, ' ').trim()

type VoteRow = {
  entityId: number
  voterId: number
  targetUserId: number | null
}

type MockOptions = {
  postRows?: number
  failPostUpdate?: number
  updateCountDelta?: number
  columns?: string[]
  indexes?: Array<[string, string[]]>
  lateNullVote?: boolean
}

const OLD_INDEXES: Array<[string, string[]]> = [
  ['post_votes.voter_id_post_id', ['voter_id', 'post_id']],
  ['comment_votes.voter_id_comment_id', ['voter_id', 'comment_id']],
  ['user_karma.voter_id_user_id', ['voter_id', 'user_id']],
]

function createMockDb(options: MockOptions = {}) {
  const columns = new Set(options.columns || [])
  const indexes = new Map(options.indexes || OLD_INDEXES)
  const queries: string[] = []
  const loadSizes: number[] = []
  const voteRows: Record<'post_votes' | 'comment_votes', VoteRow[]> = {
    post_votes: Array.from({ length: options.postRows || 0 }, (_, index) => ({
      entityId: index + 1,
      voterId: 1,
      targetUserId: null,
    })),
    comment_votes: [],
  }
  let temporaryRows: VoteRow[] = []
  let postUpdateAttempts = 0
  let lateNullInjected = false

  const runSql = jest.fn(async (query: string) => {
    const sql = normalize(query)
    queries.push(sql)

    if (sql === 'set autocommit = 1' || sql === 'set autocommit = 0') {
      return []
    }

    if (sql.includes('from information_schema.columns')) {
      const table = sql.match(/table_name = '([^']+)'/)![1]
      const column = sql.match(/column_name = '([^']+)'/)![1]
      return columns.has(`${table}.${column}`) ? [{ present: 1 }] : []
    }

    if (sql.includes('from information_schema.statistics')) {
      const table = sql.match(/table_name = '([^']+)'/)![1]
      const index = sql.match(/index_name = '([^']+)'/)![1]
      return (indexes.get(`${table}.${index}`) || []).map((columnName) => ({
        columnName,
        nonUnique: 1,
        subPart: null,
        indexType: 'BTREE',
      }))
    }

    const addColumn = sql.match(/^alter table (\w+) add column (\w+)/)
    if (addColumn) {
      columns.add(`${addColumn[1]}.${addColumn[2]}`)
      return []
    }

    const dropColumn = sql.match(/^alter table (\w+) drop column (\w+)/)
    if (dropColumn) {
      columns.delete(`${dropColumn[1]}.${dropColumn[2]}`)
      return []
    }

    if (sql.startsWith('alter table ')) {
      const table = sql.match(/^alter table (\w+)/)![1]
      // Drops apply before adds so a `drop index X, add index X (…)` rebuild inside
      // one ALTER nets to the new shape, mirroring MySQL's post-statement state.
      for (const match of sql.matchAll(/drop index (\w+)/g)) {
        indexes.delete(`${table}.${match[1]}`)
      }
      for (const match of sql.matchAll(/add index (\w+) \(([^)]+)\)/g)) {
        indexes.set(
          `${table}.${match[1]}`,
          match[2].split(',').map((column) => column.trim()),
        )
      }
      return []
    }

    if (sql.startsWith('create temporary table ')) {
      temporaryRows = []
      return []
    }
    if (sql.startsWith('drop temporary table ')) {
      temporaryRows = []
      return []
    }
    if (sql.startsWith('delete from tmp_my_votes_target_backfill')) {
      temporaryRows = []
      return { affectedRows: 0 }
    }

    if (sql.startsWith('insert into tmp_my_votes_target_backfill')) {
      const table = sql.includes('from post_votes v') ? 'post_votes' : 'comment_votes'
      // A concurrent legacy writer landing between the backfill and the drain:
      // inject one NULL row the first time the drain scans via the target index.
      if (
        options.lateNullVote &&
        table === 'post_votes' &&
        sql.includes('idx_post_votes_target_voted_at') &&
        !lateNullInjected
      ) {
        lateNullInjected = true
        voteRows.post_votes.push({ entityId: 99999, voterId: 1, targetUserId: null })
      }
      const cursorMatch = sql.match(
        /v\.(?:post_id|comment_id) > (\d+) or \(v\.(?:post_id|comment_id) = (\d+) and v\.voter_id > (\d+)\)/,
      )
      const cursor = cursorMatch ? { entityId: Number(cursorMatch[1]), voterId: Number(cursorMatch[3]) } : undefined
      temporaryRows = voteRows[table]
        .filter(
          (row) =>
            row.targetUserId === null &&
            (!cursor ||
              row.entityId > cursor.entityId ||
              (row.entityId === cursor.entityId && row.voterId > cursor.voterId)),
        )
        .slice(0, 10000)
      loadSizes.push(temporaryRows.length)
      return { affectedRows: temporaryRows.length }
    }

    if (sql.startsWith('select entity_id entityId, voter_id voterId from tmp_my_votes_target_backfill')) {
      const last = temporaryRows[temporaryRows.length - 1]
      return last ? [{ entityId: last.entityId, voterId: last.voterId }] : []
    }

    if (sql.startsWith('update tmp_my_votes_target_backfill b')) {
      const table = sql.includes('straight_join post_votes v') ? 'post_votes' : 'comment_votes'
      if (table === 'post_votes') {
        postUpdateAttempts += 1
        if (postUpdateAttempts === options.failPostUpdate) {
          throw new Error('simulated interrupted backfill')
        }
      }

      for (const selected of temporaryRows) {
        const row = voteRows[table].find(
          (candidate) => candidate.entityId === selected.entityId && candidate.voterId === selected.voterId,
        )!
        row.targetUserId = 7
      }
      return { affectedRows: temporaryRows.length + (options.updateCountDelta || 0) }
    }

    const remaining = sql.match(
      /^select (post_id|comment_id) entityId, voter_id voterId from (post_votes|comment_votes)/,
    )
    if (remaining) {
      const row = voteRows[remaining[2] as 'post_votes' | 'comment_votes'].find(
        (candidate) => candidate.targetUserId === null,
      )
      return row ? [{ entityId: row.entityId, voterId: row.voterId }] : []
    }

    if (sql.startsWith('select 1 missing')) {
      const table = sql.includes('from post_votes ') ? 'post_votes' : 'comment_votes'
      return voteRows[table].some((row) => row.targetUserId === null) ? [{ missing: 1 }] : []
    }

    throw new Error(`Unexpected migration SQL: ${sql}`)
  })

  return { columns, indexes, loadSizes, queries, runSql, voteRows }
}

describe('my votes indexes migration', () => {
  let consoleLog: jest.SpyInstance

  beforeEach(() => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleLog.mockRestore()
  })

  test('limits batches to 10k rows, resumes NULL targets, validates indexes, and restores autocommit', async () => {
    const state = createMockDb({ postRows: 10005, failPostUpdate: 2 })
    const db = { runSql: state.runSql }

    await expect(migration.up(db)).rejects.toThrow('simulated interrupted backfill')
    const firstRunEnd = state.queries.length

    expect(state.queries[0]).toBe('set autocommit = 1')
    expect(state.queries[firstRunEnd - 1]).toBe('set autocommit = 0')
    expect(state.voteRows.post_votes.filter((row) => row.targetUserId === null)).toHaveLength(5)
    expect(state.indexes.has('post_votes.voter_id_post_id')).toBe(true)

    await expect(migration.up(db)).resolves.toBeNull()

    expect(state.queries[firstRunEnd]).toBe('set autocommit = 1')
    expect(state.queries[state.queries.length - 1]).toBe('set autocommit = 0')
    expect(state.loadSizes).toContain(10000)
    expect(Math.max(...state.loadSizes)).toBe(10000)
    expect(state.queries.filter((sql) => sql.includes('limit 10000')).length).toBeGreaterThan(0)
    expect(state.queries.some((sql) => sql.includes('post_id > 10000') && sql.includes('v.voter_id > 1'))).toBe(true)
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('selected=10000 updated=10000 cursor=10000:1'))

    expect(state.columns).toEqual(new Set(['post_votes.target_user_id', 'comment_votes.target_user_id']))
    expect(state.indexes.get('post_votes.idx_post_votes_voter_voted_at')).toEqual(['voter_id', 'voted_at'])
    expect(state.indexes.get('post_votes.idx_post_votes_target_voted_at')).toEqual(['target_user_id', 'voted_at'])
    expect(state.indexes.get('user_karma.idx_user_karma_voter_voted_at')).toEqual(['voter_id', 'voted_at', 'user_id'])
    expect(state.indexes.get('user_karma.idx_user_karma_user_voted_at')).toEqual(['user_id', 'voted_at', 'voter_id'])
    expect(state.indexes.has('post_votes.voter_id_post_id')).toBe(false)
    expect(state.indexes.has('comment_votes.voter_id_comment_id')).toBe(false)
    expect(state.indexes.has('user_karma.voter_id_user_id')).toBe(false)

    const schemaAlters = state.queries.filter((sql) => sql.startsWith('alter table '))
    expect(schemaAlters.length).toBeGreaterThan(0)
    expect(schemaAlters.every((sql) => sql.includes('algorithm=inplace') && sql.includes('lock=none'))).toBe(true)

    const firstIndexBuild = state.queries.findIndex((sql) => sql.includes('add index idx_post_votes_voter_voted_at'))
    const postVerification = state.queries.findIndex(
      (sql, index) => index > firstIndexBuild && sql.includes("index_name = 'idx_post_votes_voter_voted_at'"),
    )
    const oldIndexDrop = state.queries.findIndex((sql) => sql.includes('drop index voter_id_post_id'))
    expect(firstIndexBuild).toBeGreaterThan(-1)
    expect(postVerification).toBeGreaterThan(firstIndexBuild)
    expect(oldIndexDrop).toBeGreaterThan(postVerification)
  })

  test('rebuilds on an environment where the older revision already dropped the legacy indexes', async () => {
    // The exact population the rename targets: a fully-applied old revision has
    // no voter_id-leading legacy index left, so idx_* is the sole FK support at
    // the instant of the rebuild. (FK acceptance of the one-statement drop+add
    // was confirmed against a live 5.7.44 snapshot; the mock models the state,
    // not the constraint.)
    const state = createMockDb({
      columns: ['post_votes.target_user_id', 'comment_votes.target_user_id'],
      indexes: [
        ['post_votes.idx_post_votes_voter_voted_at', ['voter_id', 'voted_at']],
        ['post_votes.idx_post_votes_target_voted_at', ['target_user_id', 'voted_at']],
        ['comment_votes.idx_comment_votes_voter_voted_at', ['voter_id', 'voted_at']],
        ['comment_votes.idx_comment_votes_target_voted_at', ['target_user_id', 'voted_at']],
        ['user_karma.idx_user_karma_voter_voted_at', ['voter_id', 'voted_at']],
        ['user_karma.idx_user_karma_user_voted_at', ['user_id', 'voted_at']],
      ],
    })

    await expect(migration.up({ runSql: state.runSql })).resolves.toBeNull()

    expect(state.indexes.get('user_karma.idx_user_karma_voter_voted_at')).toEqual(['voter_id', 'voted_at', 'user_id'])
    expect(state.indexes.get('user_karma.idx_user_karma_user_voted_at')).toEqual(['user_id', 'voted_at', 'voter_id'])
    expect(state.indexes.get('post_votes.idx_post_votes_voter_voted_at')).toEqual(['voter_id', 'voted_at'])
    expect(state.indexes.has('post_votes.voter_id_post_id')).toBe(false)
    expect(state.queries[state.queries.length - 1]).toBe('set autocommit = 0')
  })

  test('drains votes inserted by old application code after the primary-key backfill', async () => {
    const state = createMockDb({ postRows: 3, lateNullVote: true })

    await expect(migration.up({ runSql: state.runSql })).resolves.toBeNull()

    const lateRow = state.voteRows.post_votes.find((row) => row.entityId === 99999)!
    expect(lateRow.targetUserId).toBe(7)
    expect(consoleLog).toHaveBeenCalledWith('[my-votes-indexes] table=post_votes drained=1')
  })

  test('rebuilds a same-named index left behind by an older revision of this migration', async () => {
    // The 2026-05/06 revisions created user_karma feed indexes without the explicit
    // trailing PK column; environments that applied them must converge on re-run.
    const state = createMockDb({
      columns: ['post_votes.target_user_id', 'comment_votes.target_user_id'],
      indexes: [...OLD_INDEXES, ['user_karma.idx_user_karma_voter_voted_at', ['voter_id', 'voted_at']]],
    })

    await expect(migration.up({ runSql: state.runSql })).resolves.toBeNull()

    expect(state.indexes.get('user_karma.idx_user_karma_voter_voted_at')).toEqual(['voter_id', 'voted_at', 'user_id'])
    expect(
      state.queries.some((sql) =>
        sql.includes(
          'drop index idx_user_karma_voter_voted_at, ' +
            'add index idx_user_karma_voter_voted_at (voter_id, voted_at, user_id)',
        ),
      ),
    ).toBe(true)
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        'rebuilding user_karma.idx_user_karma_voter_voted_at: (voter_id, voted_at) -> (voter_id, voted_at, user_id)',
      ),
    )
    expect(state.queries[state.queries.length - 1]).toBe('set autocommit = 0')
  })

  test('fails when a batch updates a different row count than it selected', async () => {
    const state = createMockDb({ postRows: 2, updateCountDelta: -1 })

    await expect(migration.up({ runSql: state.runSql })).rejects.toThrow(
      'post_votes backfill selected 2 rows but updated 1',
    )

    expect(state.queries).toContain('drop temporary table if exists tmp_my_votes_target_backfill')
    expect(state.queries[state.queries.length - 1]).toBe('set autocommit = 0')
  })

  test('restores the exact legacy indexes with online DDL and reruns down safely', async () => {
    const state = createMockDb()
    const db = { runSql: state.runSql }

    await migration.up(db)
    const downStart = state.queries.length
    await expect(migration.down(db)).resolves.toBeNull()
    await expect(migration.down(db)).resolves.toBeNull()

    expect(state.columns).toEqual(new Set())
    expect(state.indexes.get('post_votes.voter_id_post_id')).toEqual(['voter_id', 'post_id'])
    expect(state.indexes.get('comment_votes.voter_id_comment_id')).toEqual(['voter_id', 'comment_id'])
    expect(state.indexes.get('user_karma.voter_id_user_id')).toEqual(['voter_id', 'user_id'])
    expect(state.indexes.has('post_votes.idx_post_votes_voter_voted_at')).toBe(false)
    expect(state.indexes.has('comment_votes.idx_comment_votes_target_voted_at')).toBe(false)
    expect(state.indexes.has('user_karma.idx_user_karma_user_voted_at')).toBe(false)

    const downAlters = state.queries.slice(downStart).filter((sql) => sql.startsWith('alter table '))
    expect(downAlters.length).toBeGreaterThan(0)
    expect(downAlters.every((sql) => sql.includes('algorithm=inplace') && sql.includes('lock=none'))).toBe(true)
    expect(state.queries[state.queries.length - 1]).toBe('set autocommit = 0')
  })
})
