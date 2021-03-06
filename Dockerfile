FROM node:12-buster
MAINTAINER Bryan Green "bryogreen@gmail.com"

# Install Typescript first
RUN npm install --global typescript

RUN mkdir -p /home/node/app/node_modules &&\
 chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node
COPY --chown=node:node . .

RUN yarn &&\
 tsc

EXPOSE 10902

CMD node /home/node/app/dist/index.js
