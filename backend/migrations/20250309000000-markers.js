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

exports.up = function (db, callback) {
  const sql = `
    -- Create markers table
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
      UNIQUE INDEX idx_markers_post_creator_type (marker_type, creator_id, post_id, comment_id, user_id),
    );
    
    -- Add marker counters to posts table
    ALTER TABLE posts 
      ADD COLUMN star_count INT NOT NULL DEFAULT 0,
      ADD COLUMN note_count INT NOT NULL DEFAULT 0,
      ADD COLUMN bookmark_count INT NOT NULL DEFAULT 0;
      
    -- Add marker counters to comments table
    ALTER TABLE comments
      ADD COLUMN star_count INT NOT NULL DEFAULT 0,
      ADD COLUMN note_count INT NOT NULL DEFAULT 0,
      ADD COLUMN bookmark_count INT NOT NULL DEFAULT 0;
      
    -- Add marker counters to users table
    ALTER TABLE users
      ADD COLUMN star_count INT NOT NULL DEFAULT 0,
      ADD COLUMN note_count INT NOT NULL DEFAULT 0,
      ADD COLUMN bookmark_count INT NOT NULL DEFAULT 0;
  `

  db.runSql(sql, callback)

  return null
}

exports.down = function (db, callback) {
  const sql = `    
    ALTER TABLE users
      DROP COLUMN star_count,
      DROP COLUMN note_count,
      DROP COLUMN bookmark_count;
      
    ALTER TABLE comments
      DROP COLUMN marker_count,
      DROP COLUMN star_count,
      DROP COLUMN note_count,
      DROP COLUMN bookmark_count;
      
    ALTER TABLE posts
      DROP COLUMN marker_count,
      DROP COLUMN star_count,
      DROP COLUMN note_count,
      DROP COLUMN bookmark_count;
      
    DROP TABLE markers;
  `

  db.runSql(sql, callback)

  return null
}

exports._meta = {
  version: 1,
}
