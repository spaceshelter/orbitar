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

async function backfillTargetUserId(db, votesTable, entityTable, entityField) {
  const rows = await db.runSql(`select min(${entityField}) lo, max(${entityField}) hi from ${votesTable}`)
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
    `)
  }
}

exports.up = async function (db) {
  await db.runSql('alter table post_votes add column target_user_id int default null')
  await db.runSql('alter table comment_votes add column target_user_id int default null')

  await backfillTargetUserId(db, 'post_votes', 'posts', 'post_id')
  await backfillTargetUserId(db, 'comment_votes', 'comments', 'comment_id')

  // New indexes are added before the old voter_id prefixes are dropped, so the
  // voter_id foreign keys keep an index at all times.
  await db.runSql(`
    alter table post_votes
      add index idx_post_votes_voter_voted_at (voter_id, voted_at),
      add index idx_post_votes_target_voted_at (target_user_id, voted_at),
      drop index voter_id_post_id;
    alter table comment_votes
      add index idx_comment_votes_voter_voted_at (voter_id, voted_at),
      add index idx_comment_votes_target_voted_at (target_user_id, voted_at),
      drop index voter_id_comment_id;
    alter table user_karma
      add index idx_user_karma_voter_voted_at (voter_id, voted_at),
      add index idx_user_karma_user_voted_at (user_id, voted_at),
      drop index voter_id_user_id;
  `)

  return null
}

exports.down = async function (db) {
  await db.runSql(`
    alter table user_karma
      add index voter_id_user_id (voter_id, user_id),
      drop index idx_user_karma_voter_voted_at,
      drop index idx_user_karma_user_voted_at;
    alter table comment_votes
      add index voter_id_comment_id (voter_id, comment_id),
      drop index idx_comment_votes_voter_voted_at,
      drop index idx_comment_votes_target_voted_at;
    alter table post_votes
      add index voter_id_post_id (voter_id, post_id),
      drop index idx_post_votes_voter_voted_at,
      drop index idx_post_votes_target_voted_at;
  `)

  await db.runSql('alter table comment_votes drop column target_user_id')
  await db.runSql('alter table post_votes drop column target_user_id')

  return null
}

exports._meta = {
  version: 1,
}
