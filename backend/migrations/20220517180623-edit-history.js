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
    create table content_source (
      content_source_id int primary key auto_increment,
      ref_type varchar(16) not null,
      ref_id int not null,
      author_id int not null,
      source text not null,
      comment varchar(100) null,
      created_at datetime default current_timestamp not null,
      constraint fk_content_source_author foreign key (author_id) references users(user_id) on delete cascade on update cascade,
      index idx_ref_desc (ref_type, ref_id, content_source_id desc) 
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
    
    alter table comments
      add column content_source_id int null,
      add column edit_flag tinyint null,
      add constraint fk_comments_content_source foreign key (content_source_id) references content_source(content_source_id) on delete restrict on update restrict;

    alter table posts
      add column content_source_id int null,
      add column edit_flag tinyint null,
      add constraint fk_posts_content_source foreign key (content_source_id) references content_source(content_source_id) on delete restrict on update restrict;
    
    insert into content_source (ref_type, ref_id, author_id, source, created_at)
      select 'comment', comment_id, author_id, source, created_at from comments;
     
    insert into content_source (ref_type, ref_id, author_id, source, created_at)
      select 'post', post_id, author_id, source, created_at from posts;
      
    update comments c, content_source cs set c.content_source_id=cs.content_source_id where cs.ref_type = 'comment' and cs.ref_id = c.comment_id;
    update posts p, content_source cs set p.content_source_id=cs.content_source_id where cs.ref_type = 'post' and cs.ref_id = p.post_id;
  `);
  return null;
};

exports.down = async function(db) {
  await db.runSql(`
    alter table posts
      drop foreign key fk_posts_content_source,
      drop column content_source_id;
    
    alter table comments
      drop foreign key fk_comments_content_source,
      drop column content_source_id;
      
    drop table content_source;
  `);
  return null;
};

exports._meta = {
  "version": 1
};
