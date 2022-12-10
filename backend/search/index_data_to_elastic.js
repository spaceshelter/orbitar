require('dotenv-flow').config();
const mysql = require('mysql2');
const { Client, errors} = require('@elastic/elasticsearch');
const fs = require('fs');
const {stripHtml} = require("string-strip-html");
const client = new Client({
  node: 'http://elasticsearch:9200'
});

const BATCH_SIZE = 1000;

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'orbitar',
  database: process.env.MYSQL_DATABASE || 'orbitar_db',
  lastProcessedIdFile: './id.txt'
};

const connection = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
});

const processBatch = async (startWithId) => {
  const result = await connection.promise().query(
    `select 
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
    where 
        cs.content_source_id > ${startWithId}
    order by cs.content_source_id asc
    limit ${BATCH_SIZE}
  `);

  if (!result[0] || !result[0].length) {
    return [false];
  }

  let itemId;
  let bulkInsertEntries = [];
  for (const entry of result[0]) {
    itemId = entry.content_source_id;
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
  const body = bulkInsertEntries.flatMap(doc => [{ index: { _index: 'orbitar', _id: doc.id } }, doc]);
  const response = await client.bulk({ refresh: true, body });
  console.log(`Batch done, took: ${response.body.took}`);
  if (response.body.errors) {
    console.log(`Had errors: ${JSON.stringify(response.body.errors)}`);
  }
  return [result[0].length, itemId];
};

(async () => {
  try {
    let lastProcessedId = parseInt(fs.readFileSync(config.lastProcessedIdFile).toString(), 10);
    console.log(`Starting indexing from id ${lastProcessedId}`);
    while (true) {
      let [processedCount, lastBatchProcessedId] = await processBatch(lastProcessedId);
      if (lastBatchProcessedId) {
        console.log(`Batch of ${processedCount} is done, last processed item id: ${lastBatchProcessedId}`);
        fs.writeFileSync(config.lastProcessedIdFile, lastBatchProcessedId.toString());
      }
      if (processedCount < BATCH_SIZE) {
        break;
      }
      lastProcessedId = lastBatchProcessedId;
    }
  } catch (e) {
    console.log(`error happened`, e);
  } finally {
    console.log(`done`);
    connection.end();
    process.exit();
  }
})();
