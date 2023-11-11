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
    await db.runSql(`
        alter table orbitar_db.sessions add column user_id int;
    `);

    await db.runSql(`
        UPDATE orbitar_db.sessions SET user_id = CAST(JSON_EXTRACT(data, '$.userId') AS UNSIGNED); 
    `);

    await db.runSql(`
        DELETE FROM orbitar_db.sessions
        WHERE user_id NOT IN (SELECT user_id FROM orbitar_db.users); 
    `);

    await db.runSql(`
        ALTER TABLE orbitar_db.sessions
        MODIFY COLUMN user_id INT NOT NULL;
    `);

    await db.runSql(`
        ALTER TABLE orbitar_db.sessions
        ADD CONSTRAINT fk_sessions_users
        FOREIGN KEY (user_id) REFERENCES orbitar_db.users(user_id);
    `);

    return null;
};

exports.down = async function(db) {
    await db.runSql(`
        ALTER TABLE orbitar_db.sessions
        DROP FOREIGN KEY fk_sessions_users;
        
        ALTER TABLE orbitar_db.sessions
        DROP COLUMN user_id;
    `);
    return null;
};

exports._meta = {
    "version": 1
};
