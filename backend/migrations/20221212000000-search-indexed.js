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
    alter table content_source
      add column indexed tinyint(1) not null default 0,
      add index idx_indexed (indexed);  
  `);
    return null;
};

exports.down = async function(db) {
    await db.runSql(`
    alter table content_source
      drop column indexed,
      drop index idx_indexed;     
  `);
    return null;
};

exports._meta = {
    "version": 1
};
