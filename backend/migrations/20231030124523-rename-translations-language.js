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
    // Drop all data from translations table
    await db.runSql('TRUNCATE TABLE translations;');

    // Rename column language to mode in comments and posts tables
    await db.runSql(`
        ALTER TABLE translations CHANGE language mode CHAR(2);
    `);
};

exports.down = async function (db) {
    await db.runSql(`
        ALTER TABLE translations CHANGE mode language CHAR(2);
    `);
};

exports._meta = {
    "version": 1
};
