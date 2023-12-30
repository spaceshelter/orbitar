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
        CREATE TABLE user_notes (
            author_id INT NOT NULL,
            user_id INT NOT NULL,
            note TEXT NOT NULL,
            PRIMARY KEY (author_id, user_id),
            FOREIGN KEY (author_id) REFERENCES users(user_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);
};

exports.down = async function (db) {
    await db.runSql(`
        DROP TABLE user_notes;
    `);
};

exports._meta = {
    "version": 1
};
