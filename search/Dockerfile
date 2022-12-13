FROM elasticsearch:7.17.8

RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION v16.17.0
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash
RUN /bin/bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm use --delete-prefix $NODE_VERSION"
ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

COPY elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY wait-for-it.sh setup.sh /utils/

COPY package.json index.js /app/
RUN cd /app/ && npm install

RUN /usr/local/bin/docker-entrypoint.sh elasticsearch -p /tmp/epid & /bin/bash /utils/wait-for-it.sh -t 0 localhost:9200 -- /utils/setup.sh; kill $(cat /tmp/epid) && wait $(cat /tmp/epid); exit 0;
