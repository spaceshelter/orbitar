#!/bin/bash
docker build -t orbitar-media . && \
  docker rm -f orbitar-dev-media && \
  mkdir -p ./data &&
  docker run --name orbitar-dev-media --network container:orbitar-dev-mysql-1 -v ${PWD}/data:/app/data orbitar-media
