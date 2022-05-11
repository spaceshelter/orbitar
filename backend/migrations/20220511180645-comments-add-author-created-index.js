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
  await db.runSql(`alter table comments add index author_created (author_id, created_at desc)`);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`alter table comments drop index author_created`);
  return null;
};

exports._meta = {
  "version": 1
};
