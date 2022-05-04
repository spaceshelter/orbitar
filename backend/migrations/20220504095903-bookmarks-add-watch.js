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
    alter table user_bookmarks
      drop primary key,
      drop foreign key user_bookmarks_ibfk_1,
      drop foreign key user_bookmarks_ibfk_2,
      drop index user_id,
      drop index post_id,
      drop column bookmark_id;
  
    alter table user_bookmarks
      add primary key (user_id, post_id),
      change last_comment_id last_read_comment_id int default 0,
      modify column bookmark tinyint(1) not null default 0,
      add column post_updated_at datetime not null default CURRENT_TIMESTAMP,
      add column watch tinyint(1) not null default 0,
      add index idx_user_watch (user_id, watch, post_updated_at desc),
      add index idx_user_bookmark (user_id, bookmark, last_read_comment_id desc),
      add index idx_post_bookmark (post_id, bookmark),
      add constraint fk_user_id foreign key (user_id) references users (user_id) on delete cascade on update cascade,
      add constraint fk_post_id foreign key (post_id) references posts (post_id) on delete cascade on update cascade;
      
    update user_bookmarks set bookmark=0;  
  `);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`
    alter table user_bookmarks
      drop primary key,
      drop column watch,
      drop column post_updated_at,
      drop foreign key fk_user_id,
      drop foreign key fk_post_id,
      drop index idx_user_watch,
      drop index idx_user_bookmark,
      drop index idx_post_bookmark;
  
    alter table user_bookmarks
      change last_read_comment_id last_comment_id int default 0,
      add column bookmark_id int primary key auto_increment first,
      add index user_id (user_id),
      add index post_id (post_id),
      add foreign key user_bookmarks_ibfk_1 (user_id) references users (user_id) on delete cascade on update cascade,
      add foreign key user_bookmarks_ibfk_2 (post_id) references posts (post_id) on delete cascade on update cascade;     
  `);
  return null;
};

exports._meta = {
  "version": 1
};
