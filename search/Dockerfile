FROM node:18 as build
WORKDIR /search
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install && rm -rf src

FROM node:18
COPY --from=build /search /search
WORKDIR /search
CMD npm run index