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
    // increase language size to char(3)
    await db.runSql(`
        ALTER TABLE posts MODIFY COLUMN language char(3) null default 'ru'
    `);
    await db.runSql(`
        ALTER TABLE comments MODIFY COLUMN language char(3) null default 'ru'
    `);
};

exports.down = async function (db) {
    // decrease language size to char(2)
    await db.runSql(`
        ALTER TABLE posts MODIFY COLUMN language char(2) null default 'ru'
    `);
    await db.runSql(`
        ALTER TABLE comments MODIFY COLUMN language char(2) null default 'ru'
    `);
};

exports._meta = {
    "version": 1
};
