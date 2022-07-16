if (!process.argv[2]) {
  console.log('Usage: node search.js "поисковой запрос"')
  process.exit(0);
}

const {Client: Client7} = require('es7');

const elastic_client = new Client7({
  node: 'http://localhost:9200'
});

(async () => {
  const result = await elastic_client.search({
    index: 'orbitar',
    from: 0,
    size: 10,
    body: {
      'query': {
        'multi_match': {
          'query': process.argv[2],
          'fields': [
            'title^3', 'title.en^3', 'source', 'source.en'
          ]
        }
      },
      'highlight': {
        'fields': {
          'source': {'pre_tags': ['<em>'], 'post_tags': ['</em>']},
          'title': {'pre_tags': ['<em>'], 'post_tags': ['</em>']}
        }
      }
    }
  }, {
    ignore: [404],
    maxRetries: 3
  });

  console.log(`Всего найдено: ${result.body.hits.total.value}`);
  result.body.hits.hits.map((hit) => {
    console.log(hit);
  });
})();
