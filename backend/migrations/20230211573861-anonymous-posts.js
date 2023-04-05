'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function(options, seedLink) {
    dbm = options.dbmigrate;
    type = dbm.dataType;
    seed = seedLink;
};

exports.up = async function(db) {
    // create table anonymous_posts
    // with the mapping of post_id to user_id
    await db.runSql(`
        create table anonymous_posts (
            post_id int not null,
            user_id int not null,
            primary key (post_id, user_id),
            foreign key (post_id) references posts (post_id) on delete cascade,
            foreign key (user_id) references users (user_id) on delete cascade
        );
    `);
    return null;
};

exports.down = async function(db) {
    await db.runSql(`
        drop table anonymous_posts;
    `);
    return null;
};

exports._meta = {
    "version": 1
};
