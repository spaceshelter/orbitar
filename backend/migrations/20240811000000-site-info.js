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
  await db.runSql(`alter table sites drop column site_info, add column info_source text null, add column info_html text null;`);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`alter table sites add column site_info text null, drop column info_source, drop column info_html;`);
  return null;
};

exports._meta = {
  "version": 1
};
