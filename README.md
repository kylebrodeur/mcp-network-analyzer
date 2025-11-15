# MCP Network Analyzer

A Model Context Protocol (MCP) server that provides intelligent network request analysis and automated tool generation for any website.

## Features

- 🕵️ **Network Traffic Capture**: Intercept and record HTTP requests/responses from any website
- 🧠 **Intelligent API Discovery**: Automatically identify REST patterns, authentication methods, and data structures
- 🛠️ **Tool Generation**: Generate custom export scripts for discovered APIs
- 🔍 **Data Search**: Query and search captured data
- 🌐 **Universal**: Works with any website, not just specific platforms

## Installation

```bash
pnpm install
pnpm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/Users/kylebrodeur/mcp-network-analyzer/dist/index.js"]
    }
  }
}
```

## Quick Start Example

Once connected to Claude Desktop, you can start capturing network traffic:

```
User: "Capture network traffic from https://jsonplaceholder.typicode.com/posts"

Claude: [Uses capture_network_requests tool]
Result: Captured 5 requests, 5 responses
Data saved to: data/captures/session_1731686400000_a1b2c3d4/
```

The captured data will include:
- HTTP methods, URLs, and headers
- Request/response bodies
- Timing information
- Resource types

## Project Status

- ✅ **Phase 1 Complete**: MCP server scaffold with tool registration
- ✅ **Phase 2 Complete**: Network capture tool with browser automation
- 🚧 **Phase 3 In Progress**: Analysis and pattern discovery tools
- ⏳ **Phase 4 Planned**: Export tool code generation
- ⏳ **Phase 5 Planned**: Data search and query capabilities

See [PLAN.md](docs/PLAN.md) for detailed roadmap.

## Available Tools

### `capture_network_requests` ✅ (Phase 2 - Implemented)
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

### `analyze_captured_data` (Phase 3 - Coming Soon)
Analyze captured network data to identify API patterns and authentication methods.

**Parameters:**
- `captureId` (string, required): ID from capture_network_requests
- `includeStaticAssets` (boolean, optional): Include static assets in analysis
- `outputPath` (string, optional): Custom output path for analysis results

**Returns:** Analysis with discovered endpoints, auth headers, and recommendations

### `discover_api_patterns` (Phase 3 - Coming Soon)
Deep analysis of API structure with pattern recognition.

**Parameters:**
- `analysisId` (string, required): ID from analyze_captured_data
- `minConfidence` (number, optional): Minimum confidence threshold (0-1, default: 0.5)
- `includeAuthInsights` (boolean, optional): Include authentication analysis

**Returns:** Detailed API patterns, data models, and extraction strategies

### `generate_export_tool` (Phase 4 - Coming Soon)
Generate a complete, runnable export script for the discovered API.

**Parameters:**
- `analysisId` (string, required): ID from discover_api_patterns
- `toolName` (string, required): Name for the generated tool
- `targetUrl` (string, optional): Override target URL
- `outputDirectory` (string, optional): Custom output directory
- `outputFormat` (string, optional): Output format (json, csv, sqlite - default: json)
- `incremental` (boolean, optional): Support incremental exports

**Returns:** Path to generated export script with usage instructions

### `search_exported_data` (Phase 5 - Coming Soon)
Search through previously exported data.

**Parameters:**
- `query` (string, required): Search query
- `captureId` (string, optional): Limit search to specific capture
- `statusCode` (number | number[], optional): Filter by HTTP status code
- `limit` (number, optional): Maximum results to return (default: 100, max: 1000)
- `includeResponses` (boolean, optional): Include full response bodies

**Returns:** Matching items from exported data

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# Build
pnpm run build

# Type check
pnpm run type-check
```

## Architecture

```
src/
├── index.ts              # MCP server entry point
├── tools/
│   ├── capture.ts        # Network capture tool
│   ├── analyze.ts        # Analysis tool
│   ├── discover.ts       # Pattern discovery tool
│   ├── generate.ts       # Code generation tool
│   └── search.ts         # Data search tool
└── lib/
    ├── browser.ts        # Browser automation utilities
    ├── analyzer.ts       # Request/response analysis
    ├── pattern-matcher.ts # API pattern recognition
    └── code-generator.ts  # Tool generation engine
```

## License

MIT
