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
    // repopulate user_user_rating from post_votes and comment_votes
    await db.runSql(`delete from user_user_rating;`);

    await db.runSql(`
        insert into user_user_rating (user_id, voter_id, comment_rating, post_rating)
        select user_id,
               voter_id,
               sum(cr),
               sum(pr)
        from (select author_id as user_id, voter_id, sum(vote) as cr, 0 as pr
              from comment_votes
                       left join comments on comment_votes.comment_id = comments.comment_id
              group by user_id, voter_id
              union all
              select author_id as user_id, voter_id, 0, sum(vote) as pr
              from post_votes
                       left join posts on post_votes.post_id = posts.post_id
              group by user_id, voter_id
        ) votes
        group by user_id, voter_id;
    `);

    return null;
};

exports.down = async function(db) {
};

exports._meta = {
    "version": 1
};
