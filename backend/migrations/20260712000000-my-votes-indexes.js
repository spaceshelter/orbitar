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
// This file supersedes 20260511000000-my-votes-indexes: earlier revisions shipped under
// that name, and db-migrate tracks applied migrations by filename, so environments that
// ran an old revision would never converge on the current schema. Every step here is
// guarded (column/index existence checks, exact index shapes with in-place rebuild,
// resumable backfill), which makes a re-run on any previously migrated database a no-op.
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
// rows on prod) in bounded primary-key batches; run off-peak.

const BACKFILL_BATCH_SIZE = 10000
const BACKFILL_BATCH_TABLE = 'tmp_my_votes_target_backfill'

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

async function getIndexDefinition(db, table, index) {
  const rows = await db.runSql(`
    select column_name columnName,
           non_unique nonUnique,
           sub_part subPart,
           index_type indexType
      from information_schema.statistics
     where table_schema = database()
       and table_name = '${table}'
       and index_name = '${index}'
     order by seq_in_index
  `)
  return (rows || []).map((row) => ({
    column: String(row.columnName),
    nonUnique: Number(row.nonUnique),
    subPart: row.subPart == null ? null : Number(row.subPart),
    indexType: String(row.indexType).toUpperCase(),
  }))
}

// Note: this state check (and ensureIndexes built on it) only ever describes and
// creates NON-unique BTREE indexes. That is safe here because uniqueness on all
// touched tables comes from their primary keys; do not reuse it for an index
// whose uniqueness is load-bearing - it would silently downgrade it on rebuild.
function getIndexDefinitionState(columns, definition) {
  if (!definition.length) {
    return 'missing'
  }

  const actualColumns = definition.map((part) => part.column)
  const exactColumns =
    actualColumns.length === columns.length && actualColumns.every((column, i) => column === columns[i])
  const exactShape = definition.every(
    (part) => part.nonUnique === 1 && part.subPart === null && part.indexType === 'BTREE',
  )
  return exactColumns && exactShape ? 'match' : 'mismatch'
}

async function ensureTargetColumn(db, table) {
  if (!(await columnExists(db, table, 'target_user_id'))) {
    await db.runSql(`alter table ${table} add column target_user_id int default null, algorithm=inplace, lock=none`)
  }
}

async function dropTargetColumn(db, table) {
  if (await columnExists(db, table, 'target_user_id')) {
    await db.runSql(`alter table ${table} drop column target_user_id, algorithm=inplace, lock=none`)
  }
}

async function ensureIndexes(db, table, indexes) {
  const changes = []
  for (const index of indexes) {
    const definition = await getIndexDefinition(db, table, index.name)
    const state = getIndexDefinitionState(index.columns, definition)
    if (state === 'match') {
      continue
    }
    if (state === 'mismatch') {
      // A same-named index with a different shape means this environment applied an
      // older revision of this migration. FORCE INDEX makes the exact ordered shape
      // load-bearing, so rebuild it; drop+add inside one ALTER keeps foreign keys
      // supported because MySQL validates them against the post-ALTER state.
      console.log(
        `[my-votes-indexes] rebuilding ${table}.${index.name}: ` +
          `(${definition.map((part) => part.column).join(', ')}) -> (${index.columns.join(', ')})`,
      )
      changes.push(`drop index ${index.name}`)
    }
    changes.push(`add index ${index.name} (${index.columns.join(', ')})`)
  }
  if (changes.length) {
    await db.runSql(`alter table ${table} ${changes.join(', ')}, algorithm=inplace, lock=none`)
  }

  // FORCE INDEX in the runtime query makes the exact ordered shape part of the
  // application contract. Re-read it after DDL instead of trusting only its name.
  for (const index of indexes) {
    const definition = await getIndexDefinition(db, table, index.name)
    if (getIndexDefinitionState(index.columns, definition) !== 'match') {
      throw new Error(
        `Could not create index ${table}.${index.name} (${index.columns.join(', ')}); ` +
          `found (${definition.map((part) => part.column).join(', ') || 'none'})`,
      )
    }
  }
}

async function dropIndexes(db, table, indexes) {
  const present = []
  for (const index of indexes) {
    if ((await getIndexDefinition(db, table, index)).length) {
      present.push(index)
    }
  }
  if (present.length) {
    await db.runSql(
      `alter table ${table} ${present.map((index) => `drop index ${index}`).join(', ')}, algorithm=inplace, lock=none`,
    )
  }
}

function getAffectedRows(result, operation) {
  if (!result || result.affectedRows == null) {
    throw new Error(`Could not read affected row count for ${operation}`)
  }
  const affectedRows = Number(result.affectedRows)
  if (!Number.isSafeInteger(affectedRows) || affectedRows < 0) {
    throw new Error(`Could not read affected row count for ${operation}`)
  }
  return affectedRows
}

function readCursor(row, votesTable) {
  if (!row || row.entityId == null || row.voterId == null) {
    throw new Error(`Could not read ${votesTable} backfill cursor`)
  }
  const entityId = Number(row.entityId)
  const voterId = Number(row.voterId)
  if (!Number.isSafeInteger(entityId) || !Number.isSafeInteger(voterId)) {
    throw new Error(`Could not read ${votesTable} backfill cursor`)
  }
  return { entityId, voterId }
}

function buildCursorCondition(entityField, cursor) {
  if (!cursor) {
    return ''
  }
  return (
    `and (v.${entityField} > ${cursor.entityId} or ` +
    `(v.${entityField} = ${cursor.entityId} and v.voter_id > ${cursor.voterId}))`
  )
}

async function createBatchTable(db) {
  // A leftover table from an aborted earlier call on this same connection would
  // fail the create and skip every later cleanup; clearing first makes the pair
  // of backfill calls independent.
  await db.runSql(`drop temporary table if exists ${BACKFILL_BATCH_TABLE}`)
  await db.runSql(`
    create temporary table ${BACKFILL_BATCH_TABLE} (
      entity_id int not null,
      voter_id int not null,
      primary key (entity_id, voter_id)
    ) engine=memory
  `)
}

async function backfillTargetUserId(db, votesTable, entityTable, entityField) {
  await createBatchTable(db)

  let cursor
  let batch = 0
  try {
    while (true) {
      const startedAt = Date.now()
      await db.runSql(`delete from ${BACKFILL_BATCH_TABLE}`)

      const selectedResult = await db.runSql(`
        insert into ${BACKFILL_BATCH_TABLE} (entity_id, voter_id)
        select v.${entityField}, v.voter_id
          from ${votesTable} v force index (primary)
         where v.target_user_id is null
           ${buildCursorCondition(entityField, cursor)}
         order by v.${entityField}, v.voter_id
         limit ${BACKFILL_BATCH_SIZE}
      `)
      const selected = getAffectedRows(selectedResult, `${votesTable} batch selection`)
      if (selected > BACKFILL_BATCH_SIZE) {
        throw new Error(`${votesTable} backfill selected ${selected} rows; maximum is ${BACKFILL_BATCH_SIZE}`)
      }

      if (selected === 0) {
        // A concurrent legacy writer can insert a NULL target behind the local
        // cursor. Wrap once more when that happens; the final indexed assertion
        // remains the last line of defence before the feed is enabled.
        if (cursor) {
          const remaining = await db.runSql(`
            select ${entityField} entityId, voter_id voterId
              from ${votesTable} force index (primary)
             where target_user_id is null
             order by ${entityField}, voter_id
             limit 1
          `)
          if (remaining && remaining.length) {
            cursor = undefined
            continue
          }
        }
        break
      }

      const cursorRows = await db.runSql(`
        select entity_id entityId, voter_id voterId
          from ${BACKFILL_BATCH_TABLE}
         order by entity_id desc, voter_id desc
         limit 1
      `)
      const nextCursor = readCursor(cursorRows && cursorRows[0], votesTable)

      // STRAIGHT_JOIN fixes the coarse-to-fine lock order: batch key -> entity
      // -> vote row. The temporary table bounds both locks and writes to 10k.
      const updatedResult = await db.runSql(`
        update ${BACKFILL_BATCH_TABLE} b
        straight_join ${entityTable} e on (e.${entityField} = b.entity_id)
        straight_join ${votesTable} v on (v.${entityField} = b.entity_id and v.voter_id = b.voter_id)
           set v.target_user_id = e.author_id
         where v.target_user_id is null
      `)
      const updated = getAffectedRows(updatedResult, `${votesTable} batch update`)
      if (updated !== selected) {
        throw new Error(`${votesTable} backfill selected ${selected} rows but updated ${updated}`)
      }

      batch += 1
      console.log(
        `[my-votes-indexes] table=${votesTable} batch=${batch} selected=${selected} updated=${updated} ` +
          `cursor=${nextCursor.entityId}:${nextCursor.voterId} elapsedMs=${Date.now() - startedAt}`,
      )
      cursor = nextCursor
    }
  } finally {
    await db.runSql(`drop temporary table if exists ${BACKFILL_BATCH_TABLE}`)
  }
}

// The primary-key backfill leaves a window: while the other table's backfill and
// the index builds run (online DDL admits concurrent DML), still-running old
// application code keeps inserting NULL targets. Once the target index exists,
// NULL rows are found through it in milliseconds - drain whatever accumulated so
// the assertion below races milliseconds of writes instead of minutes.
async function drainRemainingTargets(db, votesTable, entityTable, entityField, targetIndex) {
  await createBatchTable(db)
  try {
    while (true) {
      await db.runSql(`delete from ${BACKFILL_BATCH_TABLE}`)

      const selectedResult = await db.runSql(`
        insert into ${BACKFILL_BATCH_TABLE} (entity_id, voter_id)
        select v.${entityField}, v.voter_id
          from ${votesTable} v force index (${targetIndex})
         where v.target_user_id is null
         limit ${BACKFILL_BATCH_SIZE}
      `)
      const selected = getAffectedRows(selectedResult, `${votesTable} drain selection`)
      if (selected === 0) {
        break
      }

      const updatedResult = await db.runSql(`
        update ${BACKFILL_BATCH_TABLE} b
        straight_join ${entityTable} e on (e.${entityField} = b.entity_id)
        straight_join ${votesTable} v on (v.${entityField} = b.entity_id and v.voter_id = b.voter_id)
           set v.target_user_id = e.author_id
         where v.target_user_id is null
      `)
      const updated = getAffectedRows(updatedResult, `${votesTable} drain update`)
      if (updated !== selected) {
        throw new Error(`${votesTable} drain selected ${selected} rows but updated ${updated}`)
      }
      console.log(`[my-votes-indexes] table=${votesTable} drained=${selected}`)
    }
  } finally {
    await db.runSql(`drop temporary table if exists ${BACKFILL_BATCH_TABLE}`)
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
    // Unlike the vote tables, user_karma needs the trailing PK column spelled out:
    // with the 2-column shape the 5.7 planner ignores the extended-key order and
    // scans the user's whole history forward (measured on a 100k-row clone: 5001
    // handler reads vs 51 for a 51-row page).
    await ensureIndexes(db, 'user_karma', [
      { name: 'idx_user_karma_voter_voted_at', columns: ['voter_id', 'voted_at', 'user_id'] },
      { name: 'idx_user_karma_user_voted_at', columns: ['user_id', 'voted_at', 'voter_id'] },
    ])

    await drainRemainingTargets(db, 'post_votes', 'posts', 'post_id', 'idx_post_votes_target_voted_at')
    await drainRemainingTargets(db, 'comment_votes', 'comments', 'comment_id', 'idx_comment_votes_target_voted_at')

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
