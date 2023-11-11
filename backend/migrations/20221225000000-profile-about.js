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
  await db.runSql(`alter table users add column bio_source text null, add column bio_html text null;`);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`alter table users drop column bio_source, drop column bio_html;`);
  return null;
};

exports._meta = {
  "version": 1
};
