#!/bin/bash

MYSQL_CONTAINER=$(docker ps --format "{{.Names}}" | grep mysql | grep orbitar)

docker run --rm -i --name=orbitar-data-to-elasticsearch -v "${PWD}":/app --network container:"$MYSQL_CONTAINER" \
  -e "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD" \
  --entrypoint='/bin/bash' node:17 -c "cd /app/search && npm install && node index_data_to_elastic.js"
