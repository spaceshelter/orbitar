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
      create table user_activity
      (
          user_id    int      not null,
          visited_at datetime not null,
          constraint user_activity_pk
              primary key (user_id, visited_at)
      );
  `);
  return null;
};

exports._meta = {
  "version": 1
};
