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

exports.up = async function (db, callback) {
  // Create markers table
  await db.runSql(`
    CREATE TABLE markers (
      marker_id INT AUTO_INCREMENT PRIMARY KEY,
      creator_id INT NOT NULL,
      post_id INT NULL,
      comment_id INT NULL,
      user_id INT NULL,
      marker_type VARCHAR(32) NOT NULL,
      placed_count INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      removed_at TIMESTAMP NULL DEFAULT NULL,
      annotation VARCHAR(256) NULL,
      
      CONSTRAINT markers_creator_fk FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT markers_post_fk FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      CONSTRAINT markers_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
      CONSTRAINT markers_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      
      INDEX idx_markers_creator (creator_id, created_at),
      INDEX idx_markers_created_at (created_at),
      UNIQUE INDEX idx_markers_post_creator_type (marker_type, creator_id, post_id, comment_id, user_id)
    );
  `)

  // Add marker counters to posts table
  await db.runSql(`
    ALTER TABLE posts 
      ADD COLUMN star_count INT NOT NULL DEFAULT 0,
      ADD COLUMN note_count INT NOT NULL DEFAULT 0,
      ADD COLUMN bookmark_count INT NOT NULL DEFAULT 0;
  `)

  // Add marker counters to comments table
  await db.runSql(`
    ALTER TABLE comments
      ADD COLUMN star_count INT NOT NULL DEFAULT 0,
      ADD COLUMN note_count INT NOT NULL DEFAULT 0,
      ADD COLUMN bookmark_count INT NOT NULL DEFAULT 0;
  `)

  // Add marker counters to users table
  await db.runSql(`
    ALTER TABLE users
      ADD COLUMN star_count INT NOT NULL DEFAULT 0,
      ADD COLUMN note_count INT NOT NULL DEFAULT 0,
      ADD COLUMN bookmark_count INT NOT NULL DEFAULT 0;
  `)

  return null
}

exports.down = async function (db, callback) {
  // Remove marker counters from users table
  await db.runSql(`    
    ALTER TABLE users
      DROP COLUMN star_count,
      DROP COLUMN note_count,
      DROP COLUMN bookmark_count;
  `)

  // Remove marker counters from comments table
  await db.runSql(`
      ALTER TABLE comments
          DROP COLUMN star_count,
          DROP COLUMN note_count,
          DROP COLUMN bookmark_count;
  `)

  // Remove marker counters from posts table
  await db.runSql(`    
    ALTER TABLE posts
      DROP COLUMN star_count,
      DROP COLUMN note_count,
      DROP COLUMN bookmark_count;
  `)

  // Drop markers table
  await db.runSql(`DROP TABLE markers;`)

  return null
}

exports._meta = {
  version: 1,
}
