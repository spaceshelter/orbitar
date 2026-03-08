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
  await db.runSql(`
    ALTER TABLE mails
      MODIFY COLUMN to_user_id INT DEFAULT NULL
  `)
}

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM mails
    WHERE to_user_id IS NULL
  `)

  await db.runSql(`
    ALTER TABLE mails
      MODIFY COLUMN to_user_id INT NOT NULL
  `)
}

exports._meta = {
  version: 1,
}
