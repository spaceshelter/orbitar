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
    alter table sites
      add column subscribers int not null default '0',
      add column site_info text null,
      add index idx_sites_subscribers(subscribers desc, name);
    
    update sites s set s.subscribers = (
      select count(*) from user_sites ss where ss.site_id = s.site_id
    );
  `);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`
    alter table sites
      drop index idx_sites_subscribers,
      drop column subscribers,
      drop column site_info
  `);
  return null;
};

exports._meta = {
  "version": 1
};
