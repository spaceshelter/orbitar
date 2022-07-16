require('dotenv-flow').config();
const mysql = require('mysql2/promise');
const { Client: Client7 } = require('es7');

const db_config = {
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: "root",
  password: process.env.MYSQL_ROOT_PASSWORD || "orbitar",
  database: process.env.MYSQL_DATABASE || "orbitar_db",
  "multipleStatements": true
}

const per_page = 100;

const elastic_client = new Client7({
  node: 'http://localhost:9200'
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function create_dataset_item(post_or_comment, is_post) {
  return {
    id: is_post ? 'p' + post_or_comment.post_id : 'c' + post_or_comment.comment_id,
    site_id: post_or_comment.site_id,
    author_id: post_or_comment.author_id,
    created_at: Date.parse(post_or_comment.created_at) / 1000,
    ...(is_post && { post_id: post_or_comment.post_id, title: post_or_comment.title }),
    ...(!is_post && { comment_id: post_or_comment.comment_id }),
    source: post_or_comment.source
  };
}

async function main() {
  const connection = await mysql.createConnection(db_config);
  connection.config.namedPlaceholders = true;

  ['posts', 'comments'].map(async (item_type) => {
    const items_count = (await connection.query(`SELECT COUNT(*) AS num FROM ${item_type}`))[0][0].num;
    for (let i = 0; i < items_count; i += per_page) {
      const query = `SELECT * FROM ${item_type} ORDER BY created_at LIMIT ${i}, ${per_page}`;
      let items_batch = (await connection.query(query))[0];
      let bulk_dataset = [];

      for (let ii = 0; ii < items_batch.length; ii++) {
        let item = items_batch[ii];
        bulk_dataset.push(create_dataset_item(item, item_type === 'posts'));
        await sleep(100);
      }

      const body = bulk_dataset.flatMap(doc => [{index: {_index: 'orbitar', _id: doc.id}}, doc]);
      const { body: bulk_response } = await elastic_client.bulk({ refresh: true, body });
      console.log(`bulk portion processed, ${item_type} indexed: ${bulk_response.items.length}`);

      if (bulk_response.errors) {
        const erroredDocuments = []
        bulk_response.items.forEach((action, iii) => {
          const operation = Object.keys(action)[0];
          if (action[operation].error) {
            erroredDocuments.push({
              status: action[operation].status,
              error: action[operation].error,
              operation: body[iii * 2],
              document: body[iii * 2 + 1]
            })
          }
        })
        console.log(`errors: `, erroredDocuments);
      }

      await sleep(1000);
      item_type === 'comments' && process.exit(0);
    }
  });
}

main().catch(console.log);
