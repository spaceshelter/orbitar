FROM node:18 as build
WORKDIR /backend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install && npm run build && rm -rf src

FROM node:18
COPY --from=build /backend /backend
WORKDIR /backend
EXPOSE 5001
CMD npm run migration:production wait-and-up && npm run start:production
