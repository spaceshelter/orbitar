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
    await db.runSql(`
        update user_bookmarks
        set read_comments = 0
        where read_comments is null;
    `);
    await db.runSql(`
        alter table user_bookmarks modify read_comments int not null default 0;
    `)
};

exports.down = async function (db) {
    await db.runSql(`
        alter table user_bookmarks modify read_comments int null;
    `);
};

exports._meta = {
    "version": 1
};
