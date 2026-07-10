'use strict'

var dbm
var type
var seed

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

// Denormalizes the content author into the vote tables (target_user_id) and adds
// (voter_id, voted_at) / (target_user_id, voted_at) indexes so both directions of the
// profile vote feed are served by a backward index scan with early termination.
//
// The indexes deliberately do NOT include `vote`: InnoDB secondary indexes implicitly
// end with the primary key columns, which makes the index order match the feed's
// deterministic sort (voted_at desc, entity_id desc, voter_id desc). Appending `vote`
// would break that and force a filesort of the user's whole vote history (verified
// with EXPLAIN on MySQL 5.7).
//
// target_user_id stays nullable: it is a denormalized cache, the write path always
// fills it and anonymization rewrites it together with posts/comments author_id.
// No FK on purpose — vote inserts already lock a `users` row through voter_id, and a
// second parent check would only widen the deadlock surface in VoteRepository.setVotes.
//
// Ops note: the backfill touches every row of post_votes/comment_votes (millions of
// rows on prod) in primary-key chunks; run off-peak.

const CHUNK = 200000

async function columnExists(db, table, column) {
  const rows = await db.runSql(`
    select 1 present
      from information_schema.columns
     where table_schema = database()
       and table_name = '${table}'
       and column_name = '${column}'
     limit 1
  `)
  return Boolean(rows && rows.length)
}

async function indexExists(db, table, index) {
  const rows = await db.runSql(`
    select 1 present
      from information_schema.statistics
     where table_schema = database()
       and table_name = '${table}'
       and index_name = '${index}'
     limit 1
  `)
  return Boolean(rows && rows.length)
}

async function ensureTargetColumn(db, table) {
  if (!(await columnExists(db, table, 'target_user_id'))) {
    await db.runSql(`alter table ${table} add column target_user_id int default null`)
  }
}

async function dropTargetColumn(db, table) {
  if (await columnExists(db, table, 'target_user_id')) {
    await db.runSql(`alter table ${table} drop column target_user_id`)
  }
}

async function ensureIndexes(db, table, indexes) {
  const missing = []
  for (const index of indexes) {
    if (!(await indexExists(db, table, index.name))) {
      missing.push(index)
    }
  }
  if (missing.length) {
    const additions = missing.map((index) => `add index ${index.name} (${index.columns.join(', ')})`)
    await db.runSql(`alter table ${table} ${additions.join(', ')}`)
  }
}

async function dropIndexes(db, table, indexes) {
  const present = []
  for (const index of indexes) {
    if (await indexExists(db, table, index)) {
      present.push(index)
    }
  }
  if (present.length) {
    await db.runSql(`alter table ${table} ${present.map((index) => `drop index ${index}`).join(', ')}`)
  }
}

async function backfillTargetUserId(db, votesTable, entityTable, entityField) {
  const rows = await db.runSql(
    `select min(${entityField}) lo, max(${entityField}) hi from ${votesTable} where target_user_id is null`,
  )
  const bounds = rows && rows[0]
  if (!bounds || bounds.lo == null) {
    return
  }

  const lo = Number(bounds.lo)
  const hi = Number(bounds.hi)
  for (let from = lo; from <= hi; from += CHUNK) {
    await db.runSql(`
      update ${votesTable} v
        join ${entityTable} e on (e.${entityField} = v.${entityField})
         set v.target_user_id = e.author_id
       where v.${entityField} >= ${from} and v.${entityField} < ${from + CHUNK}
         and v.target_user_id is null
    `)
  }
}

async function assertTargetBackfillComplete(db, votesTable, targetIndex) {
  const rows = await db.runSql(`
    select 1 missing
      from ${votesTable} force index (${targetIndex})
     where target_user_id is null
     limit 1
  `)
  if (rows && rows.length) {
    throw new Error(`Could not backfill ${votesTable}.target_user_id`)
  }
}

async function withAutocommit(db, callback) {
  // db-migrate-mysql starts every v1 migration with AUTOCOMMIT=0. DDL commits
  // implicitly but does not restore autocommit, so explicitly enable it here to
  // make every backfill chunk durable and release its locks before the next one.
  await db.runSql('set autocommit = 1')
  try {
    return await callback()
  } finally {
    // The runner writes the migration record after `up`/`down` returns and then
    // calls COMMIT. Restore its expected mode so that record remains transactional.
    await db.runSql('set autocommit = 0')
  }
}

exports.up = async function (db) {
  await withAutocommit(db, async () => {
    await ensureTargetColumn(db, 'post_votes')
    await ensureTargetColumn(db, 'comment_votes')

    await backfillTargetUserId(db, 'post_votes', 'posts', 'post_id')
    await backfillTargetUserId(db, 'comment_votes', 'comments', 'comment_id')

    // Add replacements before dropping the old voter_id prefixes, so foreign
    // keys retain a supporting index even if this resumable migration stops.
    await ensureIndexes(db, 'post_votes', [
      { name: 'idx_post_votes_voter_voted_at', columns: ['voter_id', 'voted_at'] },
      { name: 'idx_post_votes_target_voted_at', columns: ['target_user_id', 'voted_at'] },
    ])
    await ensureIndexes(db, 'comment_votes', [
      { name: 'idx_comment_votes_voter_voted_at', columns: ['voter_id', 'voted_at'] },
      { name: 'idx_comment_votes_target_voted_at', columns: ['target_user_id', 'voted_at'] },
    ])
    await ensureIndexes(db, 'user_karma', [
      { name: 'idx_user_karma_voter_voted_at', columns: ['voter_id', 'voted_at'] },
      { name: 'idx_user_karma_user_voted_at', columns: ['user_id', 'voted_at'] },
    ])

    await assertTargetBackfillComplete(db, 'post_votes', 'idx_post_votes_target_voted_at')
    await assertTargetBackfillComplete(db, 'comment_votes', 'idx_comment_votes_target_voted_at')

    await dropIndexes(db, 'post_votes', ['voter_id_post_id'])
    await dropIndexes(db, 'comment_votes', ['voter_id_comment_id'])
    await dropIndexes(db, 'user_karma', ['voter_id_user_id'])
  })

  return null
}

exports.down = async function (db) {
  await withAutocommit(db, async () => {
    await ensureIndexes(db, 'user_karma', [{ name: 'voter_id_user_id', columns: ['voter_id', 'user_id'] }])
    await ensureIndexes(db, 'comment_votes', [{ name: 'voter_id_comment_id', columns: ['voter_id', 'comment_id'] }])
    await ensureIndexes(db, 'post_votes', [{ name: 'voter_id_post_id', columns: ['voter_id', 'post_id'] }])

    await dropIndexes(db, 'user_karma', ['idx_user_karma_voter_voted_at', 'idx_user_karma_user_voted_at'])
    await dropIndexes(db, 'comment_votes', ['idx_comment_votes_voter_voted_at', 'idx_comment_votes_target_voted_at'])
    await dropIndexes(db, 'post_votes', ['idx_post_votes_voter_voted_at', 'idx_post_votes_target_voted_at'])

    await dropTargetColumn(db, 'comment_votes')
    await dropTargetColumn(db, 'post_votes')
  })

  return null
}

exports._meta = {
  version: 1,
}
