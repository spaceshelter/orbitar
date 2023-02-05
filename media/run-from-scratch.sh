#!/bin/bash
docker build -t orbitar-media . && \
  docker rm -f orbitar-dev-media && \
  mkdir -p ./data &&
  docker run --ulimit nofile=65536:65536 --name orbitar-dev-media --network container:orbitar-dev-mysql-1 -v ${PWD}/data:/app/data orbitar-media 
