FROM node:14

#WORKDIR /frontend-src
#COPY frontend/package*.json .
#RUN npm install
#COPY frontend .
#RUN npm run build && mv build /frontend && rm -rf /frontend-src

WORKDIR /backend

COPY package*.json .
RUN npm install

COPY . .

EXPOSE 5001
CMD [ "npm", "run", "start" ]
