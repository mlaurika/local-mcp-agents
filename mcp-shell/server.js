import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
const port = process.env.PORT || 8080;

const server = new Server({
    name: 'sandbox-shell',
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
                name: 'run_command',
                description: 'Executes arbitrary shell commands within a highly secure, isolated Linux sandbox container. It provides access to the container\'s filesystem and system utilities.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'The shell command to execute' }
                    },
                    required: ['command']
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'run_command') {
        throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const command = request.params.arguments?.command;
    if (!command) {
        return { content: [{ type: 'text', text: 'Error: command is required' }], isError: true };
    }

    try {
        // Execute with a timeout to prevent hanging the MCP server
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        
        let resultText = '';
        if (stdout) resultText += `STDOUT:\n${stdout}\n`;
        if (stderr) resultText += `STDERR:\n${stderr}\n`;
        if (!resultText) resultText = 'Command executed successfully with no output.';

        return {
            content: [{ type: 'text', text: resultText }],
            isError: false
        };
    } catch (e) {
        return {
            content: [{ type: 'text', text: `Command Failed: ${e.message}\n\nSTDOUT: ${e.stdout}\nSTDERR: ${e.stderr}` }],
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
    console.log(`Sandbox Shell MCP Server listening on port ${port}`);
});
