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
  await db.runSql(`alter table posts add column parser_version int not null default 0;`);
  await db.runSql(`alter table comments add column parser_version int not null default 0;`);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`alter table posts drop column parser_version;`);
  await db.runSql(`alter table comments drop column parser_version;`);
  return null;
};

exports._meta = {
  "version": 1
};
