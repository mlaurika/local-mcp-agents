FROM node:20-alpine

WORKDIR /app

# Add generic system tools for the shell to be useful
RUN apk add --no-cache bash git curl jq python3 py3-pip build-base

COPY package.json ./
RUN npm install

COPY server.js ./

ENTRYPOINT ["node", "server.js"]
