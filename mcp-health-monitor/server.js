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
    { id: 'filesystem', name: 'FileSystem', host: 'filesystem', port: 8080, extPort: 8101, path: '/sse' },
    { id: 'brave', name: 'Brave Search', host: 'brave-search', port: 8080, extPort: 8102, path: '/sse' },
    { id: 'calculator', name: 'Calculator', host: 'calculator', port: 8080, extPort: 8103, path: '/sse' },
    { id: 'memory', name: 'Memory Graph', host: 'memory', port: 8080, extPort: 8104, path: '/sse' },
    { id: 'github', name: 'GitHub', host: 'github', port: 8080, extPort: 8105, path: '/sse' },
    { id: 'sqlite', name: 'SQLite', host: 'sqlite', port: 8080, extPort: 8106, path: '/sse' },
    { id: 'puppeteer', name: 'Puppeteer', host: 'puppeteer', port: 8080, extPort: 8107, path: '/sse' },
    { id: 'shell', name: 'Sandbox Shell', host: 'shell', port: 8080, extPort: 8108, path: '/sse' }
];

// Health state store
const healthState = {};
AGENTS.forEach(agent => {
    healthState[agent.id] = { ...agent, online: false, lastCheck: null, latencyMs: 0, error: null };
});

// Polling Engine
async function pingAgent(agent) {
    const url = `http://${agent.host}:${agent.port}/health`;
    const start = Date.now();
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        const latency = Date.now() - start;
        
        if (response.ok) {
            const data = await response.json();
            healthState[agent.id].online = true;
            healthState[agent.id].latencyMs = latency;
            healthState[agent.id].telemetry = data;
            healthState[agent.id].error = null;
        } else {
            healthState[agent.id].online = false;
            healthState[agent.id].error = `HTTP ${response.status}`;
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

// Poll every 60 seconds
setInterval(pollAll, 60000);
// Initial poll immediately
pollAll();

// API Endpoint
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/api/status', (req, res) => {
    res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        agents: Object.values(healthState)
    });
});

app.get('/api/agent/:id', (req, res) => {
    const agentId = req.params.id;
    if (healthState[agentId]) {
        res.json({ ok: true, agent: healthState[agentId] });
    } else {
        res.status(404).json({ ok: false, error: 'Agent not found' });
    }
});

app.post('/api/poll', async (req, res) => {
    try {
        console.log('[API] Manual poll requested');
        await pollAll();
        res.json({ ok: true, message: 'Polling completed successfully', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[API] Poll error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Health Monitor dashboard listening on port ${PORT}`);
});
