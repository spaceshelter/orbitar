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

exports.up = function(db, callback) {
  db.createTable('sessions', {
    id: { type: 'string', length: 64, primaryKey: true },
    data: { type: 'text', notNull: true },
    used: { type: 'datetime', notNull: true, defaultValue: new String('CURRENT_TIMESTAMP') },
  }, callback);
  db.runSql(`grant delete on ${process.env.MYSQL_DATABASE}.* to '${process.env.MYSQL_USER}'@'%';`, callback);
  return null;
};

exports.down = function(db, callback) {
  db.dropTable('sessions', callback);
  return null;
};

exports._meta = {
  "version": 1
};
