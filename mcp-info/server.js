import express from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();
const port = process.env.PORT || 8080;
const USER_LOCATION = process.env.USER_LOCATION || "Helsinki";
const USER_TIMEZONE = process.env.USER_TIMEZONE || "Europe/Helsinki";

// Create MCP server
const server = new McpServer({
  name: "general-information",
  version: "1.0.0"
});

// Helper to fetch weather
async function fetchWeather(place) {
  try {
    const res = await fetch(`https://fmi.laurikainen.fi/current?place=${encodeURIComponent(place)}`);
    if (!res.ok) {
      return `Failed to fetch weather for ${place}: ${res.statusText}`;
    }
    const data = await res.json();
    return `Current weather in ${data.station_name || place}:
- Temperature: ${data.temperature}°C
- Wind Speed: ${data.wind_speed} m/s
- Humidity: ${data.humidity}%
(Data from FMI, time: ${new Date(data.time * 1000).toISOString()})`;
  } catch (err) {
    return `Error fetching weather: ${err.message}`;
  }
}

server.tool(
  "get_general_context",
  "Returns a comprehensive context including current time, user location, and automatically resolved current weather.",
  {},
  async () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: USER_TIMEZONE,
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short'
    });
    
    const timeStr = formatter.format(now);
    const weatherStr = await fetchWeather(USER_LOCATION);

    const result = `Current General Context:
Time: ${timeStr}
User Location: ${USER_LOCATION}

Weather Status:
${weatherStr}`;

    return {
      content: [{ type: "text", text: result }]
    };
  }
);

server.tool(
  "get_weather",
  "Allows querying the weather for an arbitrary location using the FMI OpenAPI.",
  {
    place: z.string().describe("Name of the location to fetch weather for (e.g., Tampere, Oulu)")
  },
  async ({ place }) => {
    const weatherStr = await fetchWeather(place);
    return {
      content: [{ type: "text", text: weatherStr }]
    };
  }
);

let transport;

app.get('/sse', async (req, res) => {
  transport = new SSEServerTransport('/message', res);
  await server.connect(transport);
});

app.post('/message', async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE connection.");
  }
});

app.listen(port, () => {
  console.log(`General Information MCP server running on port ${port}`);
});
