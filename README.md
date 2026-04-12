# Local MCP Army

A Docker Compose based "army" of localized Model Context Protocol (MCP) servers, made available to local LLMs via network connections over explicit HTTP ports using Server-Sent Events (SSE).

## 🚀 Getting Started

1. **Copy the Env file:**
   ```bash
   cp .env.example .env
   ```

2. **Supply API Keys:**
   Open `.env` and provide keys for the tools you wish to use (like GitHub and Google Search). Refer to the comments inside `.env.example` for where to obtain the keys.

3. **Spin up your Army:**
   ```bash
   docker compose up -d --build
   ```

4. **View the Dashboard 📊:**
   Open a browser to `http://localhost:8100` to view the stunning, real-time Glassmorphic Health Monitor checking on the status of all your tools!

## 🛠️ Included Tools

All servers mount their communication directly over HTTP/SSE. 

| Tool | Internal Container Usage | Host Mapped Port | Notes |
|------|-----------|-----------|-------|
| 📂 **FileSystem** | `@modelcontextprotocol/server-filesystem` | `localhost:8101` | Mapped restrictively to `~/AI` and `~/GIT`. |
| 🦁 **Brave Search** | `@modelcontextprotocol/server-brave-search` | `localhost:8102` | Needs `BRAVE_API_KEY` in `.env`. |
| 🧮 **Calculator** | Custom Python Evaluator Server | `localhost:8103` | Safe python arithmetic evaluation. |
| 🧠 **Memory** | `@modelcontextprotocol/server-memory` | `localhost:8104` | Knowledge graph memory for casual info tracking. |
| 🐙 **GitHub** | `@modelcontextprotocol/server-github` | `localhost:8105` | Interacts with github repos; needs `GITHUB_PERSONAL_ACCESS_TOKEN`. |
| 🗄️ **SQLite** | `@modelcontextprotocol/server-sqlite` | `localhost:8106` | Casual database storage. Mounts to `./data/mcp.db`. |
| 🌐 **Browser** | `@modelcontextprotocol/server-puppeteer` | `localhost:8107` | Headless Chromium browser automation. |
| 💻 **Sandbox Shell** | Custom Sandbox Exec MCP | `localhost:8108` | Safely execute bash commands isolated inside an Alpine container. |

## Connectivity

Local LLM clients that support connecting via HTTP (SSE) can point to the specific endpoints to connect and use these tools seamlessly.

*Note on Paths: While the legacy HTTP+SSE spec used separated `/sse` and `/message` endpoints, modern Streamable HTTP specifications recommend a unified `/mcp` path. These agent proxies wrap the standard `@modelcontextprotocol/sdk` legacy behavior, exposing `/sse`, but also intelligently compute relative paths to support proxy prefixes flawlessly.*

### Single Machine Deployment (No Proxy)

If you are just running on a single machine, you can connect directly to the exposed ports (`localhost:810x`).

For example, connecting to the calculator natively:
`http://localhost:8103/sse`

### Split Node Deployment (Workstation + Remote Server)

If you have a dual-node setup (e.g., Local Mac + Proxmox LXC Server):

1. **Node 1 (Local):** Run `docker compose -f node1-docker-compose.yml up -d` to spin up a standalone file-system tool that safely edits files locally (Binding to `127.0.0.1:8101`). Connect your LLM to `http://localhost:8101/sse`.
2. **Node 2 (Remote):** Run `docker compose -f node2-docker-compose.yml up -d` on your remote Debian LXC to host the heavy compute/API tools. Deploy `node2-nginx.conf` directly into `/etc/nginx/conf.d/` on the LXC to reverse-proxy port 80 dynamically across the stack! Connect to these securely via the proxy URL over Wireguard, e.g., `http://mcp.dhcp.ee/calculator/sse`.
