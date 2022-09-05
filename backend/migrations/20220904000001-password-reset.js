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
    drop table if exists user_password_reset;
    create table user_password_reset (
      user_id int(11) not null,
      code varchar(32) not null,
      generated_at datetime not null default CURRENT_TIMESTAMP,
      unique key (\`code\`),
      constraint fk_reset_password_user foreign key (user_id) references users(user_id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
  `);

  return null;
};

exports.down = async function(db) {
  await db.dropTable('user_password_reset');
  return null;
};

exports._meta = {
  "version": 1
};
