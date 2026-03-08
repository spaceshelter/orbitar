'use strict'

var dbm
var type
var seed

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE users
      ADD COLUMN public_key_alg VARCHAR(32) NOT NULL DEFAULT '' AFTER public_key
  `)

  // Existing RSA mailbox keys are incompatible with v2.
  await db.runSql(`
    UPDATE users
    SET public_key = '', public_key_alg = ''
  `)

  await db.runSql(`
    CREATE TABLE mails (
      mail_id INT NOT NULL AUTO_INCREMENT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      from_user_id INT NOT NULL,
      to_user_id INT NOT NULL,
      post_id INT DEFAULT NULL,
      comment_id INT DEFAULT NULL,
      v TINYINT NOT NULL,
      to_payload TEXT NOT NULL,
      from_payload TEXT DEFAULT NULL,
      PRIMARY KEY (mail_id),
      KEY from_user_id (from_user_id),
      KEY to_user_id (to_user_id),
      KEY post_id (post_id),
      KEY comment_id (comment_id),
      CONSTRAINT mails_ibfk_1 FOREIGN KEY (from_user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT mails_ibfk_2 FOREIGN KEY (to_user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT mails_ibfk_3 FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT mails_ibfk_4 FOREIGN KEY (comment_id) REFERENCES comments (comment_id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `)
}

exports.down = async function (db) {
  await db.runSql(`
    DROP TABLE mails
  `)

  await db.runSql(`
    ALTER TABLE users
      DROP COLUMN public_key_alg
  `)
}

exports._meta = {
  version: 1,
}
