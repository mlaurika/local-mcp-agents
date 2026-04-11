FROM python:3.11-alpine

WORKDIR /app

COPY requirements.txt ./
# Install gcc for some mcp python dependencies if needed
RUN apk add --no-cache build-base && \
    pip install --no-cache-dir -r requirements.txt && \
    apk del build-base

COPY server.py ./

ENTRYPOINT ["python", "-u", "server.py"]
