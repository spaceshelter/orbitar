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
        create index idx_user_karma_user_id_voted_at on user_karma (user_id, voted_at desc );
    `);
    return null;
};

exports.up = async function (db) {
    await db.runSql(`
        create index idx_user_invites_parent_id_invited on user_invites (parent_id, invited);
    `);
    return null;
};

exports.down = async function (db) {
    await db.runSql('drop index idx_user_karma_user_id_voted_at');
};

exports.down = async function (db) {
    await db.runSql('drop index idx_user_invites_parent_id_invited');
};

exports._meta = {
    "version": 1
};
