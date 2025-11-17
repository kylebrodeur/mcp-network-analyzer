# MCP Network Analyzer

A Model Context Protocol (MCP) server that provides intelligent network request analysis and automated tool generation for any website.

## Features

- 🕵️ **Network Traffic Capture**: Intercept and record HTTP requests/responses from any website
- 🧠 **Intelligent API Discovery**: Automatically identify REST patterns, authentication methods, and data structures
- 🛠️ **Tool Generation**: Generate custom export scripts for discovered APIs using HuggingFace + Nebius AI
- 🔍 **Data Search**: Query and search captured data
- 🌐 **Universal**: Works with any website, not just specific platforms
- 🎨 **Gradio Web UI**: Beautiful interface for non-technical users (deploy to Modal)

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
- Choosing storage mode (Local, Cloud, HuggingFace Dataset, or Blaxel)
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

Connect to a hosted MCP server (e.g., on Blaxel, AWS, or your own infrastructure). Best for:
- Team collaboration (shared captures)
- Production deployments
- Cloud-native setups

```bash
pnpm run setup  # Choose "Remote" when prompted
```

**Setup prompts:**
1. Remote server URL (e.g., `https://run.blaxel.ai/username/functions/mcp-network-analyzer/mcp`)
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

MCP Network Analyzer supports three storage modes:

### Local Mode (Default)
Stores all captured data in local file system.

```bash
# Default: uses ./data directory
MCP_STORAGE_MODE=local node dist/index.js

# Custom local directory
MCP_STORAGE_MODE=local MCP_NETWORK_ANALYZER_DATA=/path/to/data node dist/index.js
```

### Cloud Mode
Stores captured data in cloud storage (AWS S3, Google Cloud Storage, Azure Blob, etc.).

```bash
# AWS S3 example
MCP_STORAGE_MODE=cloud \
MCP_CLOUD_PROVIDER=aws-s3 \
MCP_CLOUD_BUCKET=my-bucket \
MCP_CLOUD_REGION=us-east-1 \
MCP_CLOUD_ACCESS_KEY_ID=your-access-key \
MCP_CLOUD_SECRET_ACCESS_KEY=your-secret-key \
node dist/index.js
```

**Supported Cloud Providers:**
- `aws-s3` - Amazon S3
- `gcp-storage` - Google Cloud Storage
- `azure-blob` - Azure Blob Storage
- `custom` - Custom S3-compatible endpoint

**Cloud Configuration Environment Variables:**
- `MCP_STORAGE_MODE` - Set to `cloud` for cloud storage
- `MCP_CLOUD_PROVIDER` - Cloud storage provider
- `MCP_CLOUD_BUCKET` - Bucket/container name
- `MCP_CLOUD_REGION` - Region (AWS/GCP)
- `MCP_CLOUD_ENDPOINT` - Custom endpoint URL (for S3-compatible services)
- `MCP_CLOUD_ACCESS_KEY_ID` - Access key/credential
- `MCP_CLOUD_SECRET_ACCESS_KEY` - Secret key/credential

### Blaxel Mode (MCP Hosting)
Integrates with [Blaxel](https://blaxel.ai) hosting service for optimized MCP storage.

```bash
# Blaxel hosting
MCP_STORAGE_MODE=blaxel \
BLAXEL_PROJECT_ID=your-project-id \
BLAXEL_API_KEY=your-api-key \
node dist/index.js

# Optional: Custom Blaxel endpoint
BLAXEL_ENDPOINT=https://api.custom.blaxel.ai \
MCP_STORAGE_MODE=blaxel \
BLAXEL_PROJECT_ID=your-project-id \
BLAXEL_API_KEY=your-api-key \
node dist/index.js
```

**Blaxel Configuration Environment Variables:**
- `MCP_STORAGE_MODE` - Set to `blaxel` for Blaxel hosting
- `BLAXEL_PROJECT_ID` - Your Blaxel project identifier
- `BLAXEL_API_KEY` - Your Blaxel API key (optional for local dev)
- `BLAXEL_ENDPOINT` - Custom endpoint (optional, defaults to https://api.blaxel.ai)

## Transport Modes

MCP Network Analyzer supports two transport modes:

### Stdio Transport (Default)
Used for local testing with Claude Desktop and MCP Inspector. This is the default mode when running `node dist/index.js`.

```bash
pnpm run build
node dist/index.js
```

### HTTP/Streamable HTTP Transport
Required for Blaxel cloud hosting and remote MCP connections. Uses Express.js with Server-Sent Events (SSE) for streaming.

```bash
# Start HTTP server (default port 3000)
pnpm run start:http

# Development mode with watch
pnpm run dev:http

# Custom port
PORT=3001 node dist/index-http.js

# Blaxel hosting (uses BL_SERVER_HOST and BL_SERVER_PORT)
BL_SERVER_HOST=0.0.0.0 BL_SERVER_PORT=8080 node dist/index-http.js
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

### Local Mode (Default)
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

### Cloud Mode (AWS S3)
```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/Users/kylebrodeur/mcp-network-analyzer/dist/index.js"],
      "env": {
        "MCP_STORAGE_MODE": "cloud",
        "MCP_CLOUD_PROVIDER": "aws-s3",
        "MCP_CLOUD_BUCKET": "my-bucket",
        "MCP_CLOUD_REGION": "us-east-1",
        "MCP_CLOUD_ACCESS_KEY_ID": "your-access-key",
        "MCP_CLOUD_SECRET_ACCESS_KEY": "your-secret-key"
      }
    }
  }
}
```

### Blaxel Mode (Hosted MCP)
```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/Users/kylebrodeur/mcp-network-analyzer/dist/index.js"],
      "env": {
        "MCP_STORAGE_MODE": "blaxel",
        "BLAXEL_PROJECT_ID": "your-project-id",
        "BLAXEL_API_KEY": "your-api-key"
      }
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
- ✅ **Phase 2.5 Complete**: Blaxel deployment with HTTP/Streamable HTTP transport
- 🚧 **Phase 3 In Progress**: Analysis and pattern discovery tools (hackathon priority)
- 🚧 **Phase 4 In Progress**: Export code generation with Claude API (hackathon priority)
- 🆕 **Phase 4.5 Planned**: Modal + Gradio 6 web UI (hackathon demo)
- ⏳ **Phase 5 Planned**: Data search and query capabilities

**Current Features:**

- Full network traffic capture with Playwright
- Multi-mode storage: local, cloud (S3/GCS/Azure), and Blaxel
- **Production deployment on Blaxel with private workspace authentication**
- **Live endpoint**: `https://run.blaxel.ai/kylebrodeur/functions/mcp-network-analyzer/mcp`

**Coming Soon (Hackathon):**

- Request/response analysis with endpoint grouping
- Authentication method detection (cookies, bearer tokens, custom headers)
- API pattern discovery (REST, pagination, rate limiting)
- **AI-powered code generation** (TypeScript, Python, Go, JavaScript)
- **Gradio 6 web UI on Modal** for visualization and interaction
- Data model inference from responses

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

### `generate_export_tool` ✅ Implemented

Generate a complete, runnable export script for the discovered API using Claude AI.

**Parameters:**

- `analysisId` (string, required): ID from discover_api_patterns
- `toolName` (string, required): Name for the generated tool
- `model` (string, optional): Model to use via HuggingFace + Nebius provider (default: Qwen/Qwen2.5-VL-72B-Instruct)
  - Available models: All Nebius models on HuggingFace Hub
  - Configure Nebius API key at: <https://huggingface.co/settings/inference-providers>
- `targetUrl` (string, optional): Override target URL (auto-detected if not provided)
- `outputDirectory` (string, optional): Custom output directory (default: data/generated)
- `outputFormat` (string, optional): Output format (json, csv, sqlite - default: json)
- `language` (string, optional): Programming language (typescript, python, javascript, go - default: typescript)
- `incremental` (boolean, optional): Support incremental exports (planned feature)

**Returns:**

- `generatedPath`: Full path to generated script
- `fileName`: Name of the generated file
- `language`: Programming language used
- `linesOfCode`: Number of lines generated
- `tokensUsed`: Claude API tokens consumed
- `instructions`: Usage instructions for running the script

**Features:**

- 🤖 **AI-Powered**: Uses HuggingFace Inference with Nebius provider for intelligent code generation
- 🔐 **Secure**: API keys stored in HuggingFace account settings, not passed as parameters
- 🔐 **Authentication**: Automatic auth injection (Bearer, API key, cookies) in generated code
- 📄 **Pagination**: Handles pagination automatically
- ⚡ **Rate Limiting**: Configurable delays between requests
- 🛡️ **Error Handling**: Retry logic and comprehensive error handling
- 📝 **Type Safety**: TypeScript types or Python type hints
- 🚀 **Production Ready**: Executable immediately after generation

**Setup:**

1. Get a Nebius Token Factory API key: <https://tokenfactory.nebius.com/project/api-keys>
2. Add it to your HuggingFace account: <https://huggingface.co/settings/inference-providers>
   - Click the key icon in the "Nebius Token Factory" row
   - Enter your Nebius API key
3. Set your HuggingFace token as an environment variable:

   ```bash
   export HF_TOKEN="hf_your_token_here"
   ```

**Environment Variables:**

- `HF_TOKEN` (required): Your HuggingFace token (get from <https://huggingface.co/settings/tokens>)
- `NEBIUS_MODEL` (optional): Default model to use (default: Qwen/Qwen2.5-VL-72B-Instruct)

**Example:**

```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportApiData",
    "language": "typescript",
    "outputFormat": "json"
  }
}
```

**Example with custom model:**

```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportApiData",
    "model": "meta-llama/Llama-3.3-70B-Instruct",
    "language": "python",
    "outputFormat": "json"
  }
}
```

**Generated Script Usage:**

```bash
# TypeScript
tsx data/generated/exportApiData.ts --output export.json --auth YOUR_TOKEN

# Python
python data/generated/exportApiData.py --output export.json --auth YOUR_TOKEN

# JavaScript
node data/generated/exportApiData.js --output export.json

# Go
cd data/generated && go build exportApiData.go && ./exportApiData --output export.json
```

### `search_exported_data` ⏳ Planned

Search through previously exported data.

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

Pass environment variables for cloud or Blaxel storage:

```bash
# Cloud storage (AWS S3)
npx @modelcontextprotocol/inspector \
  -e MCP_STORAGE_MODE=cloud \
  -e MCP_CLOUD_PROVIDER=aws-s3 \
  -e MCP_CLOUD_BUCKET=my-bucket \
  -e MCP_CLOUD_REGION=us-east-1 \
  node dist/index.js

# Blaxel hosting
npx @modelcontextprotocol/inspector \
  -e MCP_STORAGE_MODE=blaxel \
  -e BLAXEL_PROJECT_ID=your-project-id \
  -e BLAXEL_API_KEY=your-api-key \
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
pnpm run dev          # stdio mode
pnpm run dev:http     # HTTP mode

# Build
pnpm run build

# Start production servers
node dist/index.js         # stdio mode
pnpm run start:http        # HTTP mode

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
