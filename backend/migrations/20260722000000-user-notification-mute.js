'use strict'

var dbm
var type
var seed

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = async function (db) {
  // Per-user notification mute list.
  // (user_id) mutes notifications triggered by (muted_user_id).
  // This is mute, not ignore: the muted user's posts/comments stay fully visible;
  // only the notifications (and web push) they would trigger for the muter are suppressed.
  await db.createTable('user_notification_mute', {
    user_id: {
      type: 'int',
      primaryKey: true,
      foreignKey: {
        name: 'idx_mute_user',
        table: 'users',
        rules: { onDelete: 'cascade', onUpdate: 'cascade' },
        mapping: 'user_id',
      },
    },
    muted_user_id: {
      type: 'int',
      primaryKey: true,
      foreignKey: {
        name: 'idx_mute_muted_user',
        table: 'users',
        rules: { onDelete: 'cascade', onUpdate: 'cascade' },
        mapping: 'user_id',
      },
    },
    created_at: { type: 'datetime', notNull: true, defaultValue: new String('CURRENT_TIMESTAMP') },
  })
  return null
}

exports.down = function (db, callback) {
  db.dropTable('user_notification_mute', callback)
  return null
}

exports._meta = {
  version: 1,
}
