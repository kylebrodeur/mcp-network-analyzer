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

## Available Tools

### `capture_network_requests`
Launch a browser session to capture network traffic from a target website.

**Parameters:**
- `url` (string): Target website URL
- `waitForNavigation` (boolean, optional): Wait for specific user actions

**Returns:** Paths to captured request/response JSON files

### `analyze_captured_data`
Analyze captured network data to identify API patterns and authentication methods.

**Parameters:**
- `capturedRequestsPath` (string): Path to captured-requests.json
- `capturedResponsesPath` (string): Path to captured-responses.json

**Returns:** Analysis with discovered endpoints, auth headers, and recommendations

### `discover_api_patterns`
Deep analysis of API structure with pattern recognition.

**Parameters:**
- `analysisPath` (string): Path to analysis.json from previous step

**Returns:** Detailed API patterns, data models, and extraction strategies

### `generate_export_tool`
Generate a complete, runnable export script for the discovered API.

**Parameters:**
- `patternsAnalysis` (object): Output from discover_api_patterns
- `toolName` (string): Name for the generated tool
- `outputPath` (string): Where to save the generated script

**Returns:** Path to generated export script

### `search_exported_data`
Search through previously exported data.

**Parameters:**
- `query` (string): Search query
- `dataPath` (string): Path to exported data directory

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
