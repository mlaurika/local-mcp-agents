import express from 'express';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json({ limit: '10mb' }));

const port = process.env.PORT || 8080;
const [cmd, ...args] = process.argv.slice(2);

if (!cmd) {
    console.error("Usage: node server.js <command> [args...]");
    process.exit(1);
}

// Map of sessionId -> express response object for SSE
const clients = new Map();

let child = null;
let idleTimeout = null;

function spawnChild() {
    if (child) return;
    
    console.log(`[Proxy] Waking up MCP process: ${cmd} ${args.join(' ')}`);

    let finalArgs = [...args];
    const env = { ...process.env };

    // Force Puppeteer to run without sandbox AND in headless mode by injecting all known environment variable patterns.
    // This ensures that regardless of how the @modelcontextprotocol/server-puppeteer 
    // package is implemented, it receives the instruction to skip the sandbox and run headless.
    if (cmd === 'npx' && args.includes('@modelcontextprotocol/server-puppeteer')) {
        const launchOptions = JSON.stringify({ 
            args: ['--no-sandbox', '--headless=new'],
            headless: true 
        });
        env.PUPPETEER_LAUNCH_OPTIONS = launchOptions;
        env.PUPPETEER_ARGS = '--no-sandbox --headless=new';
        env.CHROME_ARGS = '--no-sandbox --headless=new';
        env.CHROMIUM_ARGS = '--no-sandbox --headless=new';
    }

    child = spawn(cmd, finalArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: env
    });

    child.on('error', (err) => console.error('[Child Error]', err));
    child.stderr.on('data', (data) => console.error('[Child Log]', data.toString().trim()));

    let buffer = '';
    child.stdout.on('data', (data) => {
        buffer += data.toString();
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
            const line = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 1);
            boundary = buffer.indexOf('\n');
            
            if (line) {
                for (const [id, res] of clients.entries()) {
                    res.write(`event: message\ndata: ${line}\n\n`);
                }
            }
        }
    });

    child.on('close', (code) => {
        console.log(`[Child] MCP server exited with code ${code}`);
        child = null;
        for (const res of clients.values()) {
            res.end();
        }
        clients.clear();
    });
}

function killChild() {
    if (child) {
        console.log(`[Proxy] Scaling to zero. Killing idle MCP process...`);
        child.kill('SIGTERM');
        child = null;
    }
}

// SSE Endpoint
app.get('/sse', (req, res) => {
    const sessionId = randomUUID();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Announce the message endpoint URL as per MCP SSE specification
    const prefix = req.headers['x-forwarded-prefix'] || '';
    const endpoint = `${prefix}/message?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);
    
    clients.set(sessionId, res);
    console.log(`[SSE] Client connected: ${sessionId} (Active clients: ${clients.size})`);

    // Wake the child up if it was asleep
    if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
    }
    spawnChild();

    req.on('close', () => {
        clients.delete(sessionId);
        console.log(`[SSE] Client disconnected: ${sessionId} (Active clients: ${clients.size})`);
        
        // If all clients disconnect, wait 10 seconds before killing process
        if (clients.size === 0) {
            idleTimeout = setTimeout(() => {
                killChild();
            }, 10000); // 10 second scale-to-zero debounce
        }
    });
});

// Message Endpoint
app.post('/message', (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId || !clients.has(sessionId)) {
        return res.status(400).send('Invalid or missing sessionId');
    }

    if (!child) {
        return res.status(503).send('Tool process is asleep/offline');
    }

    try {
        const messageStr = JSON.stringify(req.body);
        child.stdin.write(messageStr + '\n');
        res.status(202).send('Accepted');
    } catch (e) {
        console.error('[Error processing message]', e);
        res.status(500).send('Failed to proxy message');
    }
});

// Healthcheck
app.get('/health', (req, res) => {
    const memory = process.memoryUsage();
    res.json({
        status: 'online',
        uptime_seconds: Math.floor(process.uptime()),
        active_connections: clients.size,
        child_process_state: child ? 'ACTIVE' : 'ASLEEP',
        ram_usage_mb: Math.round(memory.rss / 1024 / 1024)
    });
});

app.listen(port, () => {
    console.log(`[Proxy] Lazy-Routing listening on HTTP port ${port}`);
});
