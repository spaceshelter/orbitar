'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
    dbm = options.dbmigrate;
    type = dbm.dataType;
    seed = seedLink;
};

exports.up = async function (db) {
    // add  reason_source column to user_invites table
    await db.runSql(`
        ALTER TABLE invites
        ADD COLUMN reason_source text NULL;
    `);

    await db.runSql(`
        UPDATE invites SET reason_source = reason;
    `);
};

exports.down = async function (db) {
    // remove reason_source column from user_invites table
    await db.runSql(`
        ALTER TABLE invites
        DROP COLUMN reason_source;
    `);
};

exports._meta = {
    "version": 1
};
