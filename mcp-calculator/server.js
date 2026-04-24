import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { evaluate } from 'mathjs';

const app = express();
const port = process.env.PORT || 8080;

const server = new Server({
    name: 'calculator',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {}
    }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'calculate',
                description: 'Performs complex mathematical computations and evaluates algebraic expressions using the mathjs library. Use this for arithmetic, trigonometry, calculus, or any symbolic math.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        expression: { type: 'string', description: 'Mathematical expression, e.g. 2 + 2' }
                    },
                    required: ['expression']
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'calculate') {
        throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const expression = request.params.arguments?.expression;
    if (!expression) {
        return { content: [{ type: 'text', text: 'Error: expression is required' }], isError: true };
    }

    try {
        const result = evaluate(expression);
        return {
            content: [{ type: 'text', text: String(result) }],
            isError: false
        };
    } catch (e) {
        return {
            content: [{ type: 'text', text: `Calculation Error: ${e.message}` }],
            isError: true
        };
    }
});

let sseTransport = null;

app.get('/sse', async (req, res) => {
    const prefix = req.headers['x-forwarded-prefix'] || '';
    sseTransport = new SSEServerTransport(`${prefix}/message`, res);
    await server.connect(sseTransport);
    
    res.on('close', () => {
        console.log('SSE connection closed');
    });
});

app.post('/message', async (req, res) => {
    if (sseTransport) {
        await sseTransport.handlePostMessage(req, res);
    } else {
        res.status(400).send('No active SSE connection');
    }
});

app.get('/health', (req, res) => {
    const memory = process.memoryUsage();
    res.json({
        status: 'online',
        uptime_seconds: Math.floor(process.uptime()),
        active_connections: sseTransport ? 1 : 0,
        child_process_state: 'NATIVE',
        ram_usage_mb: Math.round(memory.rss / 1024 / 1024)
    });
});

app.listen(port, () => {
    console.log(`Node Calculator MCP Server listening on port ${port}`);
});
