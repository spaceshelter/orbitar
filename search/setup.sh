#!/bin/bash
curl -X PUT "localhost:9200/orbitar?pretty" -H 'Content-Type: application/json' -d '{
  "settings": {
    "index": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "analysis": {
      "filter": {
        "russian_stop": {
          "type": "stop",
          "stopwords": "_russian_"
        },
        "russian_keywords": {
          "type": "keyword_marker",
          "keywords": []
        },
        "russian_stemmer": {
          "type": "stemmer",
          "language": "russian"
        }
      },
      "analyzer": {
        "russian_analyzer": {
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "russian_stop",
            "russian_keywords",
            "russian_stemmer"
          ]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "created_at": {
        "type": "date",
        "format": "epoch_millis"
      },
      "doc_type": {
        "type": "integer"
      },
      "post_id": {
        "type": "integer"
      },
      "comment_id": {
        "type": "integer"
      },
      "site_id": {
        "type": "integer"
      },
      "author_id": {
        "type": "integer"
      },
      "parent_comment_author_id": {
        "type": "integer"
      },
      "comment_post_id": {
        "type": "integer"
      },
      "gold": {
        "type": "integer"
      },
      "rating": {
        "type": "integer"
      },
      "title": {
        "type": "text",
        "analyzer": "russian_analyzer"
      },
      "source": {
        "type": "text",
        "analyzer": "russian_analyzer"
      }
    }
  }
}'
