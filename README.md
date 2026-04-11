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
   docker compose up -d
   ```

## 🛠️ Included Tools

All servers mount their communication directly over HTTP/SSE. 

| Tool | Internal Container Usage | Host Mapped Port | Notes |
|------|-----------|-----------|-------|
| 📂 **FileSystem** | `@modelcontextprotocol/server-filesystem` | `localhost:8101` | Mapped restrictively to `~/AI` and `~/GIT`. |
| 🔍 **Google Search** | Custom Google Search implementation | `localhost:8102` | Needs `GOOGLE_API_KEY` and `CUSTOM_SEARCH_ENGINE_ID` in `.env`. |
| 🧮 **Calculator** | Custom Python Evaluator Server | `localhost:8103` | Safe python arithmetic evaluation. |
| 🧠 **Memory** | `@modelcontextprotocol/server-memory` | `localhost:8104` | Knowledge graph memory for casual info tracking. |
| 🐙 **GitHub** | `@modelcontextprotocol/server-github` | `localhost:8105` | Interacts with github repos; needs `GITHUB_PERSONAL_ACCESS_TOKEN`. |
| 🗄️ **SQLite** | `@modelcontextprotocol/server-sqlite` | `localhost:8106` | Casual database storage. Mounts to `./data/mcp.db`. |
| 🌐 **Browser** | `@modelcontextprotocol/server-puppeteer` | `localhost:8107` | Headless Chromium browser automation. |
| 💻 **Sandbox Shell** | Custom Sandbox Exec MCP | `localhost:8108` | Safely execute bash commands isolated inside an Alpine container. |

## Connectivity

Local LLM clients that support connecting via HTTP (SSE) can be pointed to the specific `localhost:[PORT]/sse` endpoints to connect and use these tools natively.

For example, connecting to the calculator:
`http://localhost:8103/sse`
