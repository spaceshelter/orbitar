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
    // skip if name '/20221021345324-translation' or '/22102134532452-translation'
    // exists in migrations table
    // temporary hack to fix migration order
    const result = await db.connection.promise().query(`
        select name from migrations where name = '/20221021345324-translation' or name = '/22102134532452-translation';
    `);

    if (result.length > 0) {
        return;
    }

    // add field language to table comments and posts
    const defaultLang = process.env.DEFAULT_TL_LANGUAGE || 'ru';

    await db.runSql(`
        alter table comments add column language char(2) default '${defaultLang}';
        alter table posts add column language char(2)  default '${defaultLang}';
    `);

    // uk: Є є Ї ї
    await db.runSql(`
        update comments set language = 'uk' where source like '%Є%' or source like '%є%' or source like '%Ї%' or source like '%ї%';
        update posts set language = 'uk' where source like '%Є%' or source like '%є%' or source like '%Ї%' or source like '%ї%';
    `);

    // content_source_translation table
    await db.runSql(`
        create table translations (
            content_source_id int not null,
            language char(2) not null,
            title text not null,
            html text not null,
            primary key (content_source_id, language),
            foreign key (content_source_id) references content_source(content_source_id) on delete cascade
        );
    `);
};

exports.down = async function (db) {
    await db.runSql(`
        alter table comments drop column language;
        alter table posts drop column language;
        drop table translations;
    `);
};

exports._meta = {
    "version": 1
};
