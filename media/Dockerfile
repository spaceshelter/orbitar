FROM node:18 as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install && npm run build && rm -rf src

FROM node:18
COPY --from=build /app /app
WORKDIR /app

CMD npm run start:production
