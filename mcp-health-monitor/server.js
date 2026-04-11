import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve static assets (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Define our Agents to monitor
const AGENTS = [
    { id: 'filesystem', name: 'FileSystem', host: 'filesystem', port: 8080 },
    { id: 'brave', name: 'Brave Search', host: 'brave-search', port: 8080 },
    { id: 'calculator', name: 'Calculator', host: 'calculator', port: 8080 },
    { id: 'memory', name: 'Memory Graph', host: 'memory', port: 8080 },
    { id: 'github', name: 'GitHub', host: 'github', port: 8080 },
    { id: 'sqlite', name: 'SQLite', host: 'sqlite', port: 8080 },
    { id: 'puppeteer', name: 'Puppeteer', host: 'puppeteer', port: 8080 },
    { id: 'shell', name: 'Sandbox Shell', host: 'shell', port: 8080 }
];

// Health state store
const healthState = {};
AGENTS.forEach(agent => {
    healthState[agent.id] = { ...agent, online: false, lastCheck: null, latencyMs: 0, error: null };
});

// Polling Engine
async function pingAgent(agent) {
    const url = `http://${agent.host}:${agent.port}/sse`;
    const start = Date.now();
    try {
        // SSE requires us to fetch, await headers, and immediately close so we don't hold the stream forever
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        const latency = Date.now() - start;
        
        if (response.ok) {
            healthState[agent.id].online = true;
            healthState[agent.id].latencyMs = latency;
            healthState[agent.id].error = null;
        } else {
            healthState[agent.id].online = false;
            healthState[agent.id].error = `HTTP ${response.status}`;
        }
        
        // Critically important: Abort the incoming SSE stream to free up resources
        if (response.body) {
            await response.body.cancel();
        }
    } catch (err) {
        healthState[agent.id].online = false;
        healthState[agent.id].error = err.name === 'TimeoutError' ? 'Timeout' : 'Unreachable';
    }
    
    healthState[agent.id].lastCheck = new Date().toISOString();
}

async function pollAll() {
    console.log(`[Monitor] Scanning network for ${AGENTS.length} MCP endpoints...`);
    // Run all pings concurrently
    await Promise.all(AGENTS.map(agent => pingAgent(agent)));
}

// Poll every 30 seconds
setInterval(pollAll, 30000);
// Initial poll immediately
pollAll();

// API Endpoint
app.get('/api/status', (req, res) => {
    res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        agents: Object.values(healthState)
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Health Monitor dashboard listening on port ${PORT}`);
});
