FROM node:18 as build
WORKDIR /frontend-build
COPY package*.json ./
RUN npm install
COPY . .
ARG SERVER_DOMAIN
ENV REACT_APP_ROOT_DOMAIN=${SERVER_DOMAIN}
ARG API_DOMAIN
ENV REACT_APP_API_DOMAIN=${API_DOMAIN}
ARG MEDIA_HOSTING_URL
ENV REACT_APP_MEDIA_HOSTING_URL=${MEDIA_HOSTING_URL}
ARG VAPID_PUBLIC_KEY
ENV REACT_APP_VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
RUN npm run build && cp -r build/ /build
WORKDIR /build
RUN rm -rf /frontend-build

FROM node:18
COPY --from=build /build /build
CMD rm -rf /frontend/* && cp -r /build/. /frontend/ && ls /frontend
