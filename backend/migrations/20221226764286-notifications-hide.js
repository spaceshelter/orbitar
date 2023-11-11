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
    alter table notifications
      add column hidden tinyint(1) not null default 0,
      add index idx_user_hidden_notification (user_id, hidden, notification_id desc);
   `);
    await db.runSql('update notifications set hidden=1 where `read`=1;');
    return null;
};

exports.down = async function(db) {
    await db.runSql(`
    alter table notifications
        drop index idx_user_hidden_notification,
        drop column hidden;
  `);
    return null;
};

exports._meta = {
    "version": 1
};
