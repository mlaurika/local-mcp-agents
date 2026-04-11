#!/bin/bash
echo "Building proxy and running tests via Docker..."
docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c "npm install && npm test"
