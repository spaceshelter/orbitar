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
    create table user_credentials (
      user_id int not null,
      \`type\` varchar(32) not null,
      \`value\` text not null,
      created_at datetime default current_timestamp not null,
      constraint pk_user_credentials primary key (user_id, \`type\`),
      constraint fk_credentials_user foreign key (user_id) references users(user_id) on delete cascade on update cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
  `);
  return null;
};

exports.down = async function(db) {
  await db.dropTable('user_credentials');
  return null;
};

exports._meta = {
  "version": 1
};
