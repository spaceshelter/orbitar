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
  alter table invites
    add column reason text null;
    
  alter table posts
    add column gold tinyint not null default '0';
  `);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`
  alter table invites
    drop column reason;
  alter table posts
    drop column gold;
  `);
  return null;
};

exports._meta = {
  "version": 1
};
