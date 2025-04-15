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
  // Modify the mode column to use varchar(10) instead of char(2)
  await db.runSql(`
        ALTER TABLE translations MODIFY mode VARCHAR(10) NOT NULL;
    `)
}

exports.down = async function (db) {
  // Revert the column change
  await db.runSql(`
        ALTER TABLE translations MODIFY mode CHAR(2) NOT NULL;
    `)
}

exports._meta = {
  version: 1,
}
