'use strict'

var dbm
var type
var seed

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE oauth_clients
    ADD COLUMN client_type ENUM('public', 'confidential') NOT NULL DEFAULT 'confidential'
    AFTER grants;
  `)

  return null
}

exports.down = async function (db) {
  await db.runSql(`
    ALTER TABLE oauth_clients
    DROP COLUMN client_type;
  `)
  return null
}

exports._meta = {
  version: 1,
}
