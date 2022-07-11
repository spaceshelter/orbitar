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
      drop table if exists user_site_rating;
      create table user_site_rating
      (
          user_id        int           not null,
          site_id        int           not null,
          comment_rating int default 0 not null,
          post_rating    int default 0 not null,
          primary key (user_id, site_id),
          constraint fk_user_site_rating_user_id foreign key (user_id) references users (user_id) on delete cascade on update cascade,
          constraint fk_user_site_rating_site_id foreign key (site_id) references sites (site_id) on delete cascade on update cascade
      ) engine=InnoDB;
  `);

  // populate from post_votes and comment_votes
    await db.runSql(`
        insert into user_site_rating (user_id, site_id, comment_rating, post_rating)
        select user_id,
               site_id,
               sum(cr),
               sum(pr)
        from (select author_id as user_id, site_id, sum(vote) as cr, 0 as pr
              from comment_votes
                       left join comments on comment_votes.comment_id = comments.comment_id
              group by user_id, site_id
              union all
              select author_id as user_id, site_id, 0, sum(vote) as pr
              from post_votes
                       left join posts on post_votes.post_id = posts.post_id
              group by user_id, site_id
        ) votes
        group by user_id, site_id;
    `);

  return null;
};

exports.down = async function(db) {
  await db.runSql('drop table user_site_rating;');
};

exports._meta = {
  "version": 1
};
