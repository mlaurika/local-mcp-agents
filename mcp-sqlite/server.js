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

// Start the underlying MCP Stdio server
console.log(`Starting MCP server: ${cmd} ${args.join(' ')}`);
const child = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
});

child.on('error', (err) => console.error('[Child Error]', err));
child.stderr.on('data', (data) => console.error('[Child Log]', data.toString().trim()));

// Listen for stdout from the child process (newline-delimited JSON RPC messages)
let buffer = '';
child.stdout.on('data', (data) => {
    buffer += data.toString();
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf('\n');
        
        if (line) {
            // Forward the message to all active SSE clients
            // (In a strict 1:1 local deployment proxy, we can broadcast or track request ids if needed,
            // but standard MCP proxy mostly broadcasts back to the single connected LLM client)
            for (const [id, res] of clients.entries()) {
                res.write(`event: message\ndata: ${line}\n\n`);
            }
        }
    }
});

child.on('close', (code) => {
    console.log(`[Child] MCP server exited with code ${code}`);
    // Close all SSE streams safely
    for (const res of clients.values()) {
        res.end();
    }
    process.exit(code);
});

// SSE Endpoint
app.get('/sse', (req, res) => {
    const sessionId = randomUUID();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Announce the message endpoint URL as per MCP SSE specification
    const endpoint = `/message?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);
    
    clients.set(sessionId, res);
    console.log(`[SSE] Client connected: ${sessionId}`);

    req.on('close', () => {
        console.log(`[SSE] Client disconnected: ${sessionId}`);
        clients.delete(sessionId);
    });
});

// Message Endpoint
app.post('/message', (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId || !clients.has(sessionId)) {
        return res.status(400).send('Invalid or missing sessionId');
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
app.get('/health', (req, res) => res.send('OK'));

app.listen(port, () => {
    console.log(`[Proxy] Listening on HTTP port ${port}`);
});
