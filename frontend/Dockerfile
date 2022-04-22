FROM node:14

WORKDIR /frontend
COPY package*.json .
RUN npm install
COPY . .

CMD ["npm", "run", "build"]
