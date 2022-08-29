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
        alter table users
            add column ontrial tinyint default 0;
    `);

    await db.runSql(`
        alter table invites
            add column restricted tinyint default 0;
    `);

    // approvers table
    await db.runSql(`
        DROP TABLE IF EXISTS user_trial_approvers;
        CREATE TABLE user_trial_approvers (
              user_id          int      NOT NULL,
              voter_id         int      NOT NULL,
              vote             int      NOT NULL,
            primary key (user_id, voter_id),
            CONSTRAINT user_trial_approvers_ibfk_4 FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT user_trial_approvers_ibfk_6 FOREIGN KEY (voter_id) REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
        ) engine=InnoDB;

    `);

    return null;
};

exports.down = async function (db) {
    await db.runSql('drop column ontrial from users');
    await db.runSql('drop column restricted from invites');
    await db.runSql('drop table user_trial_approvers');
};

exports._meta = {
    "version": 1
};
