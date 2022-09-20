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
    drop table if exists feed_sorting_settings;
    create table feed_sorting_settings (
      user_id int(11) not null,
      site_id int(11) not null,
      feed_sorting tinyint(1) not null,
      unique key (\`user_id\`, \`site_id\`),
      constraint fk_feed_sorting_settings_user foreign key (user_id) references users(user_id) on delete cascade,
      constraint fk_feed_sorting_settings_site foreign key (site_id) references sites(site_id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
  `);

  return null;
};

exports.down = async function(db) {
  await db.dropTable('feed_sorting_settings');
  return null;
};

exports._meta = {
  "version": 1
};
