FROM node:14

WORKDIR /backend

COPY package*.json .
RUN npm install

COPY . .

EXPOSE 5001
CMD node node_modules/db-migrate/bin/db-migrate up -e prod && npm run start
