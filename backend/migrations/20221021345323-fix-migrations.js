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
    db.runSql("UPDATE migrations SET name = '/20221021345324-translation' WHERE name = '/22102134532452-translation'", [], callback);
    db.runSql("UPDATE migrations SET name = '/20221026349872-fix-content-source-title' WHERE name = '/21026349872934-fix-content-source-title'", [], callback);

  return null;
};

exports.down = function(db, callback) {
    db.runSql("UPDATE migrations SET name = '/22102134532452-translation' WHERE name = '/20221021345324-translation'", [], callback);
    db.runSql("UPDATE migrations SET name = '/21026349872934-fix-content-source-title' WHERE name = '/20221026349872-fix-content-source-title'", [], callback);
    return null;
};

exports._meta = {
  "version": 1
};
