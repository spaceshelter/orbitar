#!/bin/bash
MYSQL_CONTAINER=$(docker ps --format "{{.Names}}" | grep mysql | grep orbitar)
# get backup dir from the first argument
BACKUP_DIR=$1
if [ -z "$BACKUP_DIR" ]; then
    echo "No backup dir given"
    exit 1
fi

# 30 minutes timeout
docker run --rm -i --name=orbitar-backup-media -v "${PWD}":/app -v "$BACKUP_DIR":/orbitar_backup --network container:"$MYSQL_CONTAINER" \
  -e "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD" \
  --entrypoint='/bin/bash' node:17 -c "cd /app/ && npm install && node backup_media.js /orbitar_backup"
