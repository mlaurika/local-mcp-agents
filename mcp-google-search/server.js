import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const app = express();
const port = process.env.PORT || 8080;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = process.env.CUSTOM_SEARCH_ENGINE_ID;

const server = new Server({
    name: 'google-search',
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
                name: 'google_search',
                description: 'Search the web using Google Custom Search. Provide a query and optionally the number of results.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'The search query' },
                        num: { type: 'number', description: 'Number of results to return (1-10)' }
                    },
                    required: ['query']
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'google_search') {
        throw new Error(`Unknown tool: ${request.params.name}`);
    }

    if (!GOOGLE_API_KEY || !CUSTOM_SEARCH_ENGINE_ID) {
        return {
            content: [{ type: 'text', text: 'Error: GOOGLE_API_KEY or CUSTOM_SEARCH_ENGINE_ID is not configured.' }],
            isError: true
        };
    }

    const args = request.params.arguments || {};
    const query = args.query;
    const num = args.num || 5;

    if (!query) {
        return { content: [{ type: 'text', text: 'Error: Query is required' }], isError: true };
    }

    try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.append('key', GOOGLE_API_KEY);
        url.searchParams.append('cx', CUSTOM_SEARCH_ENGINE_ID);
        url.searchParams.append('q', query);
        url.searchParams.append('num', num.toString());

        const response = await fetch(url.toString());
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Google API responded with ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        
        let resultText = '';
        if (data.items && data.items.length > 0) {
            resultText = data.items.map((item, index) => {
                return `--- Result ${index + 1} ---\nTitle: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}\n`;
            }).join('\n');
        } else {
            resultText = 'No results found.';
        }

        return {
            content: [{ type: 'text', text: resultText }],
            isError: false
        };

    } catch (e) {
        return {
            content: [{ type: 'text', text: `Failed to execute search: ${e.message}` }],
            isError: true
        };
    }
});

let sseTransport = null;

app.get('/sse', async (req, res) => {
    sseTransport = new SSEServerTransport('/message', res);
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

app.listen(port, () => {
    console.log(`Google Search MCP Server listening on port ${port}`);
});
