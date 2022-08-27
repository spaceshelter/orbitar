FROM node:14 as build
WORKDIR /frontend-build
COPY package*.json .
RUN npm install
COPY . .
ARG SERVER_DOMAIN
ENV REACT_APP_ROOT_DOMAIN=${SERVER_DOMAIN}
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
RUN npm run build && cp -r build/ /build
WORKDIR /build
RUN rm -rf /frontend-build

FROM node:14
COPY --from=build /build /build
CMD rm -rf /frontend/* && cp -r /build/. /frontend/ && ls /frontend
