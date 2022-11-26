FROM node:16 as build
WORKDIR /frontend-build
COPY package*.json ./
RUN npm install
COPY . .
ARG SERVER_DOMAIN
ENV REACT_APP_ROOT_DOMAIN=${SERVER_DOMAIN}
ARG API_DOMAIN
ENV REACT_APP_API_DOMAIN=${API_DOMAIN}
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
RUN npm run build && cp -r build/ /build
WORKDIR /build
RUN rm -rf /frontend-build

FROM node:16
COPY --from=build /build /build
CMD rm -rf /frontend/* && cp -r /build/. /frontend/ && ls /frontend
