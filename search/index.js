require('dotenv-flow').config();
const mysql = require('mysql2/promise');
const {Client} = require('@elastic/elasticsearch');
const {stripHtml} = require("string-strip-html");
const client = new Client({
  node: 'http://elasticsearch:9200'
});

const args = process.argv.slice(2);
const batchSize = parseInt(args[0], 10) || 1000;
const doReindex = args[1] || false;

const config = {
  host: 'mysql',
  port: 3306,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'orbitar',
  database: process.env.MYSQL_DATABASE || 'orbitar_db'
};

async function main() {
  const processBatch = async (offset) => {
    let indexedItemsIds = [];
    const result = await connection.query(`select 
        cs.content_source_id,
        cs.ref_type,
        cs.ref_id,
        cs.source,
        cs.author_id,
        cs.created_at,
        c.post_id as comment_post_id,
        c.parent_comment_id,
        cc.author_id as parent_comment_author_id,
        coalesce(p.site_id, c.site_id) as site_id,
        p.gold,
        p.title,
        coalesce(p.rating, c.rating) as rating
    from 
        content_source cs
    left join posts p on p.post_id = cs.ref_id and cs.ref_type = 'post'
    left join comments c on c.comment_id = cs.ref_id and cs.ref_type = 'comment'
    left join comments cc on c.parent_comment_id = cc.comment_id
    ${doReindex ? '' : ' where cs.indexed = 0'}
    order by cs.content_source_id asc
    limit ${doReindex ? (offset + ',') : ''} ${batchSize}
  `);

    if (!result[0] || !result[0].length) {
      console.log(`Fetched no results for offset ${offset}!`);
      return [];
    }

    let itemId;
    let bulkInsertEntries = [];
    for (const entry of result[0]) {
      itemId = entry.content_source_id;
      indexedItemsIds.push(itemId);
      bulkInsertEntries.push({
        id: entry.ref_type + '-' + entry.ref_id,
        created_at: new Date(entry.created_at).getTime(),
        doc_type: entry.ref_type === 'comment' ? 1 : 0,
        post_id: entry.ref_type === 'post' ? entry.ref_id : null,
        comment_id: entry.ref_type === 'comment' ? entry.ref_id : null,
        site_id: entry.site_id,
        author_id: entry.author_id,
        parent_comment_author_id: entry.parent_comment_author_id,
        comment_post_id: entry.comment_post_id,
        gold: entry.gold,
        rating: entry.rating,
        title: entry.title,
        source: stripHtml(entry.source).result
      });
    }
    const body = bulkInsertEntries.flatMap(doc => [{index: {_index: 'orbitar', _id: doc.id}}, doc]);
    const response = await client.bulk({refresh: true, body});
    console.log(`Batch done, took: ${response.body.took}`);
    if (response.body.errors) {
      console.log(`Had errors: ${JSON.stringify(response.body.errors)}`);
    }
    return indexedItemsIds;
  };

  const connection = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
  });
  console.log(`Start ${doReindex ? 're-indexing' : 'indexing'}, batch size ${batchSize}`);

  // intercept SIGTERM and SIGINT to close the connection
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
      process.on(signal, async () => {
          console.log(`Got ${signal}, closing connection`);
          await connection.end();
          process.exit(0);
      });
  });

  try {
      while (!doReindex) {
          try {
              let offset = 0;
              while (true) {
                  let processedItemsIds = await processBatch(offset);
                  if (processedItemsIds.length) {
                      console.log(`Batch of ${processedItemsIds.length} is done`);
                      const updateMysqlResult = await connection.query(
                          `UPDATE content_source
                           SET indexed = 1
                           WHERE content_source_id IN (?)`, [processedItemsIds]);
                      console.log('Rows marked as indexed:', updateMysqlResult[0].info);
                  } else {
                      break;
                  }
                  offset += processedItemsIds.length;
                  console.log(`new offset: ${offset}`);
              }
          } catch (e) {
              console.error(e);
          } finally {
              console.log(`done`);
          }

          // sleep for 1 minute
          console.log('Sleeping for 1 minute');
          await new Promise(resolve => setTimeout(resolve, 60000));
      }
  } finally {
        connection.end();
  }
}

main();
