FROM node:20-alpine

WORKDIR /app

# Install python and sqlite dependencies
RUN apk add --no-cache git python3 py3-pip build-base bash sqlite

# Install the official Python MCP SQLite server
# breaking system packages is safe inside an isolated docker container
RUN pip install --break-system-packages mcp-server-sqlite

COPY package.json ./
RUN npm install

COPY server.js ./

# The entrypoint will always be our proxy server
ENTRYPOINT ["node", "server.js"]
