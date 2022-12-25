'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
    dbm = options.dbmigrate;
    type = dbm.dataType;
    seed = seedLink;
};

exports.up = async function (db) {
    await db.runSql(`
        alter table posts
            add column main tinyint(1) not null default 0;
    `);
    await db.runSql(`
        alter table posts add index idx_posts_main (main);
    `);

    await db.runSql(`
        update posts
        set main = 1
        where site_id = 1;
    `);

    // add site_id and `main` to content_source
    await db.runSql(`
        alter table content_source
            add column site_id int null,
            add column main tinyint(1) null;
    `);

    await db.runSql(`
        alter table content_source
            add constraint fk_content_source_site_id
            foreign key (site_id) references sites(site_id) on delete SET NULL on update SET NULL;
    `);

    await db.runSql(`
        update content_source join posts on content_source.content_source_id = posts.content_source_id
            set content_source.site_id = posts.site_id, content_source.main = posts.main;
    `);

    return null;
};

exports.down = async function (db) {
    // drop fk
    await db.runSql(`
        alter table content_source
            drop foreign key fk_content_source_site_id;
    `);
    await db.runSql(`
        alter table posts drop index idx_posts_main;
    `);

    await db.runSql(`
        alter table posts
            drop column main;
    `);
    await db.runSql(`
        alter table content_source
            drop column site_id,
            drop column main;
    `);
    return null;
};

exports._meta = {
    "version": 1
};
