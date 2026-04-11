FROM node:20-alpine

WORKDIR /app

# Install git, python, build-base (make, gcc, c++), bash
# Some node modules or python scripts might need them
RUN apk add --no-cache git python3 py3-pip build-base bash

COPY package.json ./
RUN npm install

COPY server.js ./

# The entrypoint will always be our proxy server
ENTRYPOINT ["node", "server.js"]
