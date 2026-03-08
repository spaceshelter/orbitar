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
        ALTER TABLE users ADD COLUMN public_key_alg VARCHAR(32) NOT NULL DEFAULT ''
    `)

  await db.runSql(`
        UPDATE users
        SET public_key = '', public_key_alg = ''
    `)
}

exports.down = async function (db) {
  await db.runSql(`
        ALTER TABLE users DROP COLUMN public_key_alg
    `)
}

exports._meta = {
  version: 1,
}
