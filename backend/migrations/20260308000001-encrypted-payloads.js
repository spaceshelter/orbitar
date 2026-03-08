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
        CREATE TABLE encrypted_payloads (
            encrypted_payload_id INT NOT NULL AUTO_INCREMENT,
            v TINYINT NOT NULL,
            parser_profile VARCHAR(32) NOT NULL DEFAULT 'lite-v1',
            ciphertext MEDIUMTEXT NOT NULL,
            iv VARCHAR(32) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (encrypted_payload_id)
        )
    `)

  await db.runSql(`
        CREATE TABLE encrypted_payload_keys (
            encrypted_payload_key_id INT NOT NULL AUTO_INCREMENT,
            encrypted_payload_id INT NOT NULL,
            user_id INT NOT NULL,
            role VARCHAR(16) NOT NULL,
            public_key VARCHAR(128) NOT NULL,
            public_key_alg VARCHAR(32) NOT NULL,
            ephemeral_public_key VARCHAR(128) NOT NULL,
            iv VARCHAR(32) NOT NULL,
            encrypted_key VARCHAR(128) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (encrypted_payload_key_id),
            UNIQUE KEY uq_encrypted_payload_user_role (encrypted_payload_id, user_id, role),
            KEY idx_encrypted_payload_id (encrypted_payload_id),
            KEY idx_user_id (user_id),
            CONSTRAINT fk_encrypted_payload_keys_payload FOREIGN KEY (encrypted_payload_id) REFERENCES encrypted_payloads (encrypted_payload_id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_encrypted_payload_keys_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)

  await db.runSql(`
        ALTER TABLE content_source
            ADD COLUMN encrypted_payload_id INT NULL,
            ADD CONSTRAINT fk_content_source_encrypted_payload FOREIGN KEY (encrypted_payload_id) REFERENCES encrypted_payloads (encrypted_payload_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    `)

  await db.runSql(`
        ALTER TABLE posts
            ADD COLUMN encrypted_payload_id INT NULL,
            ADD CONSTRAINT fk_posts_encrypted_payload FOREIGN KEY (encrypted_payload_id) REFERENCES encrypted_payloads (encrypted_payload_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    `)

  await db.runSql(`
        ALTER TABLE comments
            ADD COLUMN encrypted_payload_id INT NULL,
            ADD CONSTRAINT fk_comments_encrypted_payload FOREIGN KEY (encrypted_payload_id) REFERENCES encrypted_payloads (encrypted_payload_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    `)
}

exports.down = async function (db) {
  await db.runSql(`
        ALTER TABLE comments
            DROP FOREIGN KEY fk_comments_encrypted_payload,
            DROP COLUMN encrypted_payload_id
    `)

  await db.runSql(`
        ALTER TABLE posts
            DROP FOREIGN KEY fk_posts_encrypted_payload,
            DROP COLUMN encrypted_payload_id
    `)

  await db.runSql(`
        ALTER TABLE content_source
            DROP FOREIGN KEY fk_content_source_encrypted_payload,
            DROP COLUMN encrypted_payload_id
    `)

  await db.runSql(`
        DROP TABLE encrypted_payload_keys
    `)

  await db.runSql(`
        DROP TABLE encrypted_payloads
    `)
}

exports._meta = {
  version: 1,
}
