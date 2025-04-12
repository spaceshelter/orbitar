'use strict'

exports.up = async function (db) {
  await db.createTable('polls', {
    poll_id: {
      type: 'int',
      unsigned: true,
      notNull: true,
      primaryKey: true,
      autoIncrement: true,
    },
    author_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'polls_author_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE',
        },
        mapping: 'user_id',
      },
    },
    question: {
      type: 'text',
      notNull: true,
    },
    options: {
      type: 'json',
      notNull: true,
    },
    settings: {
      type: 'json',
      notNull: true,
    },
    expires_at: {
      type: 'datetime',
      notNull: false,
    },
    created_at: {
      type: 'datetime',
      notNull: true,
      defaultValue: 'CURRENT_TIMESTAMP',
    },
  })

  for (let i = 0; i <= 31; i++) {
    await db.addColumn('polls', `opt${i}`, {
      type: 'int',
      unsigned: true,
      notNull: true,
      defaultValue: 0,
    })
  }

  await db.addIndex('polls', 'idx_expires_at', ['expires_at'])
  await db.addIndex('polls', 'idx_created_at', ['created_at'])

  await db.createTable('poll_votes', {
    vote_id: {
      type: 'int',
      unsigned: true,
      notNull: true,
      primaryKey: true,
      autoIncrement: true,
    },
    poll_id: {
      type: 'int',
      unsigned: true,
      notNull: true,
      foreignKey: {
        name: 'poll_votes_poll_fk',
        table: 'polls',
        rules: {
          onDelete: 'CASCADE',
        },
        mapping: 'poll_id',
      },
    },
    voter_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'poll_votes_voter_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE',
        },
        mapping: 'user_id',
      },
    },
    option_id: {
      type: 'int',
      unsigned: true,
      notNull: true,
    },
    voted_at: {
      type: 'datetime',
      notNull: true,
      defaultValue: 'CURRENT_TIMESTAMP',
    },
  })

  await db.addIndex('poll_votes', 'unique_vote', ['poll_id', 'voter_id', 'option_id'], true)

  await db.addIndex('poll_votes', 'idx_voted_at', ['voted_at'])
}

exports.down = async function (db) {
  await db.dropTable('poll_votes')
  await db.dropTable('polls')
}

exports._meta = {
  version: 1,
}
