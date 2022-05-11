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
      add column \`read\` tinyint(1) not null default 0,
      add column by_user_id int(11),
      add column post_id int(11),
      add column comment_id int(11),
      add index idx_user_post (user_id, post_id),
      add index idx_user_read_notification (user_id, \`read\`, notification_id desc);
  `);

  const notifications = await db.runSql('select * from notifications');
  for (const notification of notifications) {
    const json = JSON.parse(notification.data);
    if (!json || !json.source) {
      continue;
    }
    const { byUserId, postId, commentId } = json.source;
    await db.runSql(`update notifications set by_user_id=?, post_id=?, comment_id=? where notification_id=?`, [byUserId, postId, commentId, notification.notification_id]);
  }
  return null;
};

exports.down = async function(db) {
  await db.runSql(`
    alter table notifications
      drop index idx_user_post,
      drop index idx_user_read_notification,
      drop column \`read\`,
      drop column by_user_id,
      drop column post_id,
      drop column comment_id;
  `);
  return null;
};

exports._meta = {
  "version": 1
};
