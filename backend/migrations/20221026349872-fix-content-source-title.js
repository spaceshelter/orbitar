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
    // update content source title from posts
    await db.runSql(`
        UPDATE content_source
        SET title = (SELECT title FROM posts WHERE posts.content_source_id = content_source.content_source_id)
        WHERE title IS NULL or title = '';
    `);
};

exports.down = async function (db) {
};

exports._meta = {
    "version": 1
};
