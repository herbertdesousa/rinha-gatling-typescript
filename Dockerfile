FROM node:22-alpine3.19

WORKDIR /home/node/app

COPY package*.json ./

RUN npm install

COPY --chown=node:node . .

CMD [ "npm", "run", "stress" ]