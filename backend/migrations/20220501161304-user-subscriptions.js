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
  await db.createTable('user_sites', {
    user_id: {
      type: 'int', primaryKey: true,
      foreignKey: {
        name: 'idx_user',
        table: 'users',
        rules: { onDelete: 'cascade', onUpdate: 'cascade' },
        mapping: 'user_id'
      }
    },
    site_id: {
      type: 'int', primaryKey: true,
      foreignKey: {
        name: 'idx_site',
        table: 'sites',
        rules: { onDelete: 'cascade', onUpdate: 'restrict' },
        mapping: 'site_id'
      }
    },
    subscribed: { type: 'datetime', notNull: true, defaultValue: new String('CURRENT_TIMESTAMP') },
    feed_main: { type: 'smallint', length: 1, notNull: true, defaultValue: 1 },
    feed_bookmarks: { type: 'smallint', length: 1, notNull: true, defaultValue: 0 },
  });
  await db.addIndex('user_sites', 'idx_site_main', ['site_id', 'feed_main']);
  await db.addIndex('user_sites', 'idx_user_main', ['user_id', 'feed_main']);
  await db.runSql('insert into user_sites (user_id, site_id) select user_id, 1 from users');
  return null;
};

exports.down = function(db, callback) {
  db.dropTable('user_sites', callback);
  return null;
};

exports._meta = {
  "version": 1
};
