import migration from '../../migrations/20260511000000-my-votes-indexes'

const normalize = (query: string) => query.replace(/\s+/g, ' ').trim()

describe('my votes indexes migration', () => {
  test('commits chunks independently, restores runner transaction mode, and resumes after a partial backfill', async () => {
    const columns = new Set<string>()
    const indexes = new Set<string>([
      'post_votes.voter_id_post_id',
      'comment_votes.voter_id_comment_id',
      'user_karma.voter_id_user_id',
    ])
    const queries: string[] = []
    let failSecondPostChunk = true
    let postChunkAttempts = 0

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
        return indexes.has(`${table}.${index}`) ? [{ present: 1 }] : []
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
        for (const match of sql.matchAll(/add index (\w+) \([^)]+\)/g)) {
          indexes.add(`${table}.${match[1]}`)
        }
        for (const match of sql.matchAll(/drop index (\w+)/g)) {
          indexes.delete(`${table}.${match[1]}`)
        }
        return []
      }

      if (sql.startsWith('select min(post_id)')) {
        return [{ lo: 1, hi: 400001 }]
      }
      if (sql.startsWith('select min(comment_id)')) {
        return [{ lo: null, hi: null }]
      }

      if (sql.startsWith('update post_votes v')) {
        postChunkAttempts += 1
        if (failSecondPostChunk && postChunkAttempts === 2) {
          failSecondPostChunk = false
          throw new Error('simulated interrupted backfill')
        }
        return { affectedRows: 1 }
      }
      if (sql.startsWith('update comment_votes v')) {
        return { affectedRows: 1 }
      }

      if (sql.startsWith('select 1 missing')) {
        return []
      }

      throw new Error(`Unexpected migration SQL: ${sql}`)
    })
    const db = { runSql }

    await expect(migration.up(db)).rejects.toThrow('simulated interrupted backfill')
    const firstRunEnd = queries.length
    expect(queries[0]).toBe('set autocommit = 1')
    expect(queries[firstRunEnd - 1]).toBe('set autocommit = 0')
    expect(columns).toEqual(new Set(['post_votes.target_user_id', 'comment_votes.target_user_id']))
    expect(indexes).toContain('post_votes.voter_id_post_id')

    await expect(migration.up(db)).resolves.toBeNull()

    expect(queries[firstRunEnd]).toBe('set autocommit = 1')
    expect(queries[queries.length - 1]).toBe('set autocommit = 0')
    expect(queries.filter((sql) => sql.includes('add column target_user_id'))).toHaveLength(2)

    const backfills = queries.filter((sql) => sql.startsWith('update post_votes v'))
    expect(backfills.length).toBeGreaterThan(2)
    expect(backfills.every((sql) => sql.includes('and v.target_user_id is null'))).toBe(true)

    const postIndexAlters = queries.filter((sql) => sql.startsWith('alter table post_votes add index'))
    expect(postIndexAlters).toHaveLength(1)
    expect(postIndexAlters[0]).toContain('add index idx_post_votes_voter_voted_at (voter_id, voted_at)')
    expect(postIndexAlters[0]).toContain('add index idx_post_votes_target_voted_at (target_user_id, voted_at)')

    expect(indexes).toContain('post_votes.idx_post_votes_voter_voted_at')
    expect(indexes).toContain('post_votes.idx_post_votes_target_voted_at')
    expect(indexes).not.toContain('post_votes.voter_id_post_id')
    expect(indexes).not.toContain('comment_votes.voter_id_comment_id')
    expect(indexes).not.toContain('user_karma.voter_id_user_id')

    const lastBackfill = queries.reduce((last, sql, index) => (sql.startsWith('update ') ? index : last), -1)
    const firstIndexBuild = queries.findIndex((sql) => sql.startsWith('alter table post_votes add index'))
    const postVerification = queries.findIndex((sql) => sql.includes('from post_votes force index'))
    const oldIndexDrop = queries.findIndex((sql) => sql.includes('drop index voter_id_post_id'))
    expect(firstIndexBuild).toBeGreaterThan(lastBackfill)
    expect(oldIndexDrop).toBeGreaterThan(postVerification)
  })
})
