# MCP Network Analyzer

A Model Context Protocol (MCP) server that provides intelligent network request capture, analysis, and API pattern discovery.

## Features

- 🕵️ **Network Traffic Capture**: Intercept and record HTTP requests/responses from any website
- 🧠 **Intelligent API Discovery**: Automatically identify REST patterns, authentication methods, and data structures

- 🔍 **Data Search**: Query and search captured data
- 🌐 **Universal**: Works with any website, not just specific platforms

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Interactive Setup

```bash
pnpm run setup
```

The setup wizard will guide you through:
- Choosing storage mode (Local or Cloud)
- Configuring credentials (if needed)
- Creating configuration files

### 3. Build the Project

```bash
pnpm run build
```

### 4. Install to Claude Desktop (Optional)

```bash
pnpm run install-claude
```

Or manually add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp-network-analyzer/dist/index.js"]
    }
  }
}
```

### 5. Check Status

```bash
pnpm run status
```

This shows your configuration, data statistics, and tool availability.

### Switching Between Profiles

Once you've saved multiple configurations (e.g., "local" and "cloud"), you can easily switch between them:

```bash
# Switch to a specific profile
pnpm run setup -- --switch local
pnpm run setup -- --switch cloud

# Interactive profile switcher
pnpm run setup -- --switch

# List all saved profiles
pnpm run setup -- --list
```

Profiles are saved in `.env.profiles.json` and switching is instant - no need to re-enter credentials!

## Server Modes

MCP Network Analyzer supports both local and remote server configurations:

### Local Server (Default)

Run the MCP server on your local machine. Best for development and when you need full control.

```bash
pnpm run setup  # Choose "Local" when prompted
```

The server runs locally and connects directly to Claude Desktop via stdio or HTTP transport.

### Remote Server

Connect to a hosted MCP server (e.g., on AWS, GCP, or your own infrastructure). Best for:
- Team collaboration (shared captures)
- Production deployments
- Cloud-native setups

```bash
pnpm run setup  # Choose "Remote" when prompted
```

**Setup prompts:**
1. Remote server URL (e.g., `https://your-server.com/mcp`)
2. Authentication method (Bearer Token, API Key, or Basic Auth)

**Example remote config:**
```json
{
  "mcpServers": {
    "network-analyzer": {
      "transport": {
        "type": "http",
        "url": "https://your-server.com/mcp",
        "headers": {
          "Authorization": "Bearer your-token"
        }
      }
    }
  }
}
```

You can save both local and remote profiles and switch between them easily!

## Installation

```bash
pnpm install
pnpm run build
```

## Storage Modes

### Local Mode (Default)
Stores all captured data in the local file system under `data/`.

```bash
# Default: uses ./data directory
node dist/index.js

# Custom local directory
MCP_NETWORK_ANALYZER_DATA=/path/to/data node dist/index.js
```

> **Note:** Cloud storage (S3/GCS/Azure) is not yet implemented. The cloud adapter interface exists but upload/download methods are stubs. Only local mode works reliably.

## Transport Modes

MCP Network Analyzer supports two transport modes:

### Stdio Transport (Default)
Used for local testing with Claude Desktop and MCP Inspector. This is the default mode when running `node dist/index.js`.

```bash
pnpm run build
node dist/index.js
```

### HTTP/Streamable HTTP Transport
For remote MCP connections and self-hosted deployments. Uses Express.js with Server-Sent Events (SSE) for streaming.

```bash
# Start HTTP server (default port 3000)
node dist/index-http.js

# Development mode with watch
pnpm run dev

# Custom port
PORT=3001 node dist/index-http.js
```

**HTTP Mode Endpoints:**
- `POST /mcp` - MCP message endpoint
- `GET /mcp` - SSE streaming endpoint
- `GET /health` - Health check endpoint

**Test HTTP mode with MCP Inspector:**

```bash
# Start the HTTP server
PORT=3001 node dist/index-http.js &

# Connect Inspector to HTTP endpoint
npx @modelcontextprotocol/inspector http://localhost:3001/mcp --transport streamable-http
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp-network-analyzer/dist/index.js"]
    }
  }
}
```

## Quick Start Example

Once connected (via Claude Desktop or MCP Inspector), you can start capturing network traffic:

### Example 1: Simple API Capture

```text
User: "Capture network traffic from https://jsonplaceholder.typicode.com/posts"

Result: 
✅ Captured 5 requests, 5 responses
📊 Discovered 2 API endpoints:
  - GET /posts
  - GET /posts/1
🔐 Authentication: None detected
📁 Data saved to: data/captures/session_1731686400000_a1b2c3d4/
```

### Example 2: Full Analysis Workflow

```text
# 1. Capture traffic
User: "Capture from https://example.com"
→ Returns captureId: session_xyz

# 2. Analyze patterns
User: "Analyze capture session_xyz"
→ Returns analysisId: analysis_abc
→ Shows endpoint groups, auth methods, content types

# 3. Discover API patterns
User: "Discover API patterns from analysis_abc"
→ Returns discoveryId: discovery_123
→ Shows REST patterns, pagination, data models

# 4. Search / query the captured data
User: "Search captured data for POST endpoints"
```

The captured data will include:

- HTTP methods, URLs, and headers
- Request/response bodies
- Timing information
- Resource types
- Authentication hints

## Project Status

- ✅ **Phase 1 Complete**: MCP server scaffold with tool registration
- ✅ **Phase 2 Complete**: Network capture tool with browser automation  
- ✅ **Phase 2.5 Complete**: HTTP/Streamable HTTP transport for remote deployments
- ✅ **Phase 3 Complete**: Analysis and pattern discovery tools
- ✅ **Phase 4 Complete**: Data search and query capabilities

**Current Features:**

- Full network traffic capture with Playwright
- Local file storage with JSON database
- REST pattern detection, authentication discovery, pagination and rate limit analysis
- Full-text search across all captured data

See [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for detailed roadmap.

## Available Tools

### `capture_network_requests` ✅ Implemented

Launch a browser session to capture network traffic from a target website.

**Parameters:**

- `url` (string, required): Target website URL
- `waitForNetworkIdleMs` (number, optional): Wait for additional network activity after page load (max 120000ms)
- `sessionId` (string, optional): Custom session ID for organizing captures
- `includeResourceTypes` (string[], optional): Explicitly include specific resource types
- `excludeResourceTypes` (string[], optional): Explicitly exclude specific resource types
- `ignoreStaticAssets` (boolean, optional): Filter out images, stylesheets, fonts, etc. (default: true)

**Returns:**

- `captureId`: Unique identifier for the capture session
- `sessionPath`: Path to captured data directory
- `totalRequests`: Number of requests captured
- `totalResponses`: Number of responses captured
- `domains`: List of unique domains accessed

**Output Files:**

- `data/captures/{sessionId}/session.json` - Complete capture session
- `data/captures/{sessionId}/requests.json` - All captured requests
- `data/captures/{sessionId}/responses.json` - All captured responses
- `data/captures/{sessionId}/metadata.json` - Session metadata and statistics

### `analyze_captured_data` ✅ Implemented

Analyze captured network data to identify API patterns and authentication methods.

**Parameters:**

- `captureId` (string, required): ID from capture_network_requests
- `includeStaticAssets` (boolean, optional): Include static assets in analysis
- `outputPath` (string, optional): Custom output path for analysis results

**Returns:** Analysis with discovered endpoints, auth headers, and recommendations

### `discover_api_patterns` ✅ Implemented

Deep analysis of API structure with pattern recognition.

**Parameters:**

- `analysisId` (string, required): ID from analyze_captured_data
- `minConfidence` (number, optional): Minimum confidence threshold (0-1, default: 0.5)
- `includeAuthInsights` (boolean, optional): Include authentication analysis

**Returns:** Detailed API patterns, data models, and extraction strategies

### `search_exported_data` ✅ Implemented

Search through previously captured and analyzed data.

**Parameters:**

- `query` (string, required): Search query
- `captureId` (string, optional): Limit search to specific capture
- `statusCode` (number | number[], optional): Filter by HTTP status code
- `limit` (number, optional): Maximum results to return (default: 100, max: 1000)
- `includeResponses` (boolean, optional): Include full response bodies

**Returns:** Matching items from exported data

## Testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a visual debugging tool for testing MCP servers. It provides an interactive UI to test tools, inspect requests/responses, and debug issues.

### Quick Start - Stdio Mode

Test your MCP server with the Inspector using stdio transport:

```bash
# Build the server first
pnpm run build

# Launch with Inspector (stdio mode)
npx @modelcontextprotocol/inspector node dist/index.js
```

### Quick Start - HTTP Mode

Test the HTTP/Streamable HTTP transport (required for Blaxel hosting):

```bash
# Terminal 1: Start the HTTP server
pnpm run build
PORT=3001 node dist/index-http.js

# Terminal 2: Connect Inspector to HTTP endpoint
npx @modelcontextprotocol/inspector http://localhost:3001/mcp --transport streamable-http
```

The Inspector will:

1. Start the MCP proxy server (port 6277)
2. Open the web UI in your browser (port 6274)
3. Display a session token for authentication
4. Connect to your MCP server automatically

### Using the Inspector

- **Test Tools**: Call any tool with a form-based interface
- **View Responses**: See formatted JSON responses and outputs
- **Check Logs**: Monitor server logs in real-time
- **Debug**: Inspect request/response cycles
- **Export Config**: Generate Claude Desktop config snippets

### With Environment Variables

Pass environment variables for custom storage paths:

```bash
# Custom data directory
npx @modelcontextprotocol/inspector \
  -e MCP_NETWORK_ANALYZER_DATA=/path/to/data \
  node dist/index.js
```

### CLI Mode

For scripting and automation:

```bash
# List available tools
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list

# Call capture tool
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name capture_network_requests \
  --tool-arg url=https://jsonplaceholder.typicode.com/posts

# Analyze captured data
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name analyze_captured_data \
  --tool-arg captureId=session_1234567890_abc123
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (with watch)
pnpm run dev          # HTTP mode (default)
pnpm run dev:stdio    # stdio mode

# Build
pnpm run build

# Start production servers
node dist/index.js         # stdio mode
node dist/index-http.js    # HTTP mode (port 3000)

# Type check
pnpm run type-check

# Clean build artifacts
pnpm run clean
```

## Architecture

```text
src/
├── index.ts              # MCP server entry point (stdio transport)
├── index-http.ts         # HTTP server entry point (streamable HTTP transport)
├── tools/
│   ├── capture.ts        # Network capture tool
│   ├── analyze.ts        # Analysis tool
│   ├── discover.ts       # Pattern discovery tool
│   └── search.ts         # Data search tool
└── lib/
    ├── browser.ts        # Browser automation utilities
    ├── analyzer.ts       # Request/response analysis
    └── pattern-matcher.ts # API pattern recognition
```

## License

MIT
