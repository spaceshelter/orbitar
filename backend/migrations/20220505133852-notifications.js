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
    create table notifications (
      notification_id int auto_increment primary key,
      user_id int not null,
      \`type\` varchar(32) not null,
      \`data\` text not null,
      created_at datetime default current_timestamp not null,
      constraint fk_notifications_user foreign key (user_id) references users(user_id) on delete cascade on update cascade,
      index idx_user_notification_id (user_id, notification_id desc)
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
    create table user_kv (
      user_id int,
      \`key\` varchar(32) not null,
      \`value\` text not null,
      version int not null default 0,
      constraint pk_userkv_type primary key (user_id, \`key\`),
      constraint fk_userkv_user foreign key (user_id) references users(user_id) on delete cascade on update cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
  `);

  return null;
};

exports.down = async function(db) {
  await db.dropTable('notifications');
  await db.dropTable('user_kv');
  return null;
};

exports._meta = {
  "version": 1
};
