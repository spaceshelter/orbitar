#!/bin/bash
MYSQL_CONTAINER=$(docker ps --format "{{.Names}}" | grep mysql | grep orbitar)
docker run --rm -it --name=orbitar-backup-media -v ${PWD}:/app --network container:$MYSQL_CONTAINER --entrypoint='/bin/bash' node:17 -c "cd /app/ && npm install && node backup_media.js"
