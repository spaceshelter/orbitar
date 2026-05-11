'use strict'

exports.up = async function (db) {
  await db.addIndex('post_votes', 'idx_post_votes_voter_voted_at', ['voter_id', 'voted_at'])
  await db.addIndex('comment_votes', 'idx_comment_votes_voter_voted_at', ['voter_id', 'voted_at'])
  await db.addIndex('user_karma', 'idx_user_karma_voter_voted_at', ['voter_id', 'voted_at'])
}

exports.down = async function (db) {
  await db.removeIndex('user_karma', 'idx_user_karma_voter_voted_at')
  await db.removeIndex('comment_votes', 'idx_comment_votes_voter_voted_at')
  await db.removeIndex('post_votes', 'idx_post_votes_voter_voted_at')
}

exports._meta = {
  version: 1,
}
