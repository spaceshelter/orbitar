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
  const sql = `
    delete from post_votes where vote_id in (
      select vote_id from (
        select min(vote_id) vote_id,post_id,voter_id,count(*) c from post_votes group by post_id,voter_id having c > 1
      ) votes
    );
    
    delete from comment_votes where vote_id in (
      select vote_id from (
        select min(vote_id) vote_id,comment_id,voter_id,count(*) c from comment_votes group by comment_id,voter_id having c > 1
      ) votes
    );
    
    alter table post_votes
      drop primary key,
      drop column vote_id,
      drop index post_id,
      add primary key(post_id, voter_id);
  
    alter table comment_votes
      drop primary key,
      drop column vote_id,
      drop index comment_id,
      add primary key(comment_id, voter_id);
      
    alter table user_karma
      drop primary key,
      drop column vote_id,
      drop index user_id,
      drop index voter_id,
      add primary key(user_id, voter_id),
      add index \`voter_id_user_id\` (voter_id, user_id);
  `;

  db.runSql(sql, callback);

  return null;
};

exports.down = function(db, callback) {
  const sql = `
    alter table post_votes
      drop foreign key post_votes_ibfk_2,
      drop foreign key post_votes_ibfk_4,
      drop primary key,
      add index post_id (post_id),
      add column vote_id int auto_increment primary key first;
    alter table post_votes
      add constraint post_votes_ibfk_2 FOREIGN KEY (post_id) REFERENCES posts(post_id),
      add constraint post_votes_ibfk_4 FOREIGN KEY (voter_id) REFERENCES users(user_id);
      
    alter table comment_votes
      drop foreign key comment_votes_ibfk_2,
      drop foreign key comment_votes_ibfk_4,
      drop primary key,
      add index comment_id (comment_id),
      add column vote_id int auto_increment primary key first;
    alter table comment_votes
      add constraint comment_votes_ibfk_2 FOREIGN KEY (comment_id) REFERENCES comments(comment_id),
      add constraint comment_votes_ibfk_4 FOREIGN KEY (voter_id) REFERENCES users(user_id);
      
    alter table user_karma
      drop foreign key user_karma_ibfk_3,
      drop foreign key user_karma_ibfk_4,
      drop index voter_id_user_id,
      drop primary key,
      add index user_id (user_id),
      add index voter_id (voter_id),
      add column vote_id int auto_increment primary key first;
    alter table user_karma
      add constraint user_karma_ibfk_3 FOREIGN KEY (user_id) REFERENCES users(user_id),
      add constraint user_karma_ibfk_4 FOREIGN KEY (voter_id) REFERENCES users(user_id);
  `;

  db.runSql(sql, callback);

  return null;
};

exports._meta = {
  "version": 1
};
