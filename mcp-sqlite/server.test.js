import request from 'supertest';
import express from 'express';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

// Setup similar to server.js for testing
const app = express();
app.use(express.json({ limit: '10mb' }));

const clients = new Map();

// For test purposes, our "child" is just an echo script that reflects what it gets
const child = spawn('node', ['-e', `
process.stdin.on('data', (d) => {
  // Try parsing to ensure it's valid JSON line, then append a dummy response field
  try {
    const msg = JSON.parse(d.toString());
    msg.echo = true;
    process.stdout.write(JSON.stringify(msg) + '\\n');
  } catch(e) {
    process.stderr.write(e.toString());
  }
});
`]);

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

app.get('/sse', (req, res) => {
    const sessionId = 'test-session-id'; // fixed for test
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`);
    clients.set(sessionId, res);
});

app.post('/message', (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId || !clients.has(sessionId)) return res.status(400).send('Invalid sessionId');
    child.stdin.write(JSON.stringify(req.body) + '\n');
    res.status(202).send('Accepted');
});

afterAll(() => {
    child.kill();
});

describe('MCP SSE Proxy', () => {
    it('Should establish SSE connection and return endpoint', async () => {
        const res = await request(app).get('/sse');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(res.text).toContain('event: endpoint');
        expect(res.text).toContain('data: /message?sessionId=test-session-id');
    });

    it('Should reject message if sessionId is invalid', async () => {
        const res = await request(app).post('/message?sessionId=bad').send({ jsonrpc: "2.0", method: "ping" });
        expect(res.status).toBe(400);
    });

    it('Should accept message and proxy response via SSE', (done) => {
        // First we open the SSE stream using native http to stream it
        const req = request(app).get('/sse');

        let dataReceived = '';
        req.buffer(false)
           .parse((res, callback) => {
               res.on('data', async (chunk) => {
                   dataReceived += chunk.toString();
                   
                   // Once we see the endpoint line, we trigger a POST message
                   if (dataReceived.includes('event: endpoint') && !dataReceived.includes('jsonrpc')) {
                       await request(app)
                            .post('/message?sessionId=test-session-id')
                            .send({ jsonrpc: "2.0", method: "test_method", id: 1 });
                   }

                   // Once we see the echo'd message in SSE stream, we pass the test
                   if (dataReceived.includes('"echo":true') && dataReceived.includes('"method":"test_method"')) {
                       res.destroy(); // kill the stream
                       done();
                   }
               });
           })
           .end(() => {}); // start request
    });
});
