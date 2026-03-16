# MCP Network Analyzer - Implementation Plan

**Project:** Generic MCP Server for Network Request Analysis & Website Tool Building
**Created:** November 15, 2025
**Updated:** March 16, 2026
**Status:** All core phases complete

> For current component status and environment setup, see [PROJECT_STATUS.md](PROJECT_STATUS.md).

***

## Project Overview

Build a Model Context Protocol (MCP) server that enables LLMs to:

1. Capture network traffic from any website
2. Intelligently analyze API patterns and data structures
3. Query and search captured data

**Key Differentiator:** Generic and reusable, not tied to any specific website or API.

***

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude)                     │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP Protocol (stdio or HTTP/SSE)
┌────────────────────▼────────────────────────────────────────┐
│                   MCP Network Analyzer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tools Layer                                         │  │
│  │  • capture_network_requests                          │  │
│  │  • analyze_captured_data                             │  │
│  │  • discover_api_patterns                             │  │
│  │  • search_exported_data                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Library Layer                                       │  │
│  │  • Browser Automation (Playwright)                   │  │
│  │  • Network Interceptor                               │  │
│  │  • Pattern Analyzer                                  │  │
│  │  • Data Storage & Search                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    [Browser]   [File System]  [JSON DB]
```

### Directory Structure

```
mcp-network-analyzer/
├── src/
│   ├── index.ts                 # MCP server entry (stdio)
│   ├── index-http.ts            # MCP server entry (HTTP/SSE)
│   │
│   ├── tools/                   # MCP tool implementations
│   │   ├── capture.ts           # Network capture tool
│   │   ├── analyze.ts           # Basic analysis tool
│   │   ├── discover.ts          # Deep pattern discovery
│   │   ├── search.ts            # Data search tool
│   │   ├── help.ts              # Help & documentation tools
│   │   ├── id-management.ts     # Session ID tools
│   │   └── query.ts             # Database query tools
│   │
│   ├── lib/                     # Core library code
│   │   ├── browser.ts           # Browser automation wrapper
│   │   ├── interceptor.ts       # Network interception logic
│   │   ├── analyzer.ts          # Request/response analyzer
│   │   ├── pattern-matcher.ts   # API pattern recognition
│   │   ├── database.ts          # JSON-based database service
│   │   ├── storage.ts           # Storage facade
│   │   ├── local-storage-adapter.ts  # Local filesystem (working)
│   │   ├── cloud-storage-adapter.ts  # Cloud storage (STUBBED - not implemented)
│   │   ├── storage-adapter.ts   # Adapter interface
│   │   ├── config.ts            # Environment config
│   │   └── types.ts             # TypeScript type definitions
│   │
├── scripts/                     # Setup & utility scripts
├── dist/                        # Compiled JavaScript
├── data/                        # Runtime data storage
│   ├── captures/                # Captured network data (written by tool)
│   ├── analyses/                # Analysis results (written by tool)
│   └── mcp-analyzer.db.json     # JSON database (captures, analyses, etc.)
│
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

***

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE

**Goal:** MCP server scaffold and basic browser automation

* [x] Initialize project with TypeScript and MCP SDK
* [x] Install dependencies (Playwright, Zod)
* [x] Create directory structure
* [x] Implement MCP server initialization (`src/index.ts`, `src/index-http.ts`)
* [x] Register all 4 tool schemas with Zod validation
* [x] Configure VS Code workspace
* [x] Implement graceful shutdown and error handling
* [x] Create browser automation wrapper (`src/lib/browser.ts`)
* [x] Set up stealth configuration (anti-bot detection)

***

### Phase 2: Network Capture ✅ COMPLETE

* [x] Implement network interceptor (`src/lib/interceptor.ts`)
* [x] Create capture tool (`src/tools/capture.ts`)
* [x] Build storage layer (`src/lib/storage.ts`, `src/lib/local-storage-adapter.ts`)
* [x] Define data schemas using Zod
* [x] Add resource type filtering
* [x] Implement session management

***

### Phase 3: Analysis Tools ✅ COMPLETE

* [x] Basic analyzer (`src/lib/analyzer.ts`) — endpoint grouping, auth detection, content types
* [x] `analyze_captured_data` tool (`src/tools/analyze.ts`)
* [x] Pattern matcher (`src/lib/pattern-matcher.ts`) — REST patterns, pagination, rate limits
* [x] `discover_api_patterns` tool (`src/tools/discover.ts`)
* [x] Authentication method detection
* [x] Data structure inference

***

### Phase 4: Code Generation — Removed

Code generation (calling Ollama/HuggingFace to write export scripts from discovered API patterns) has been removed. This responsibility belongs to the host agent/LLM, which already has the structured `discover_api_patterns` output and can generate idiomatic, context-aware code without an extra nested LLM call inside the server.

***

### Phase 5: Data Search ✅ COMPLETE

* [x] `search_exported_data` tool (`src/tools/search.ts`)
* [x] Full-text search across captures, analyses, generated tools
* [x] Status code and capture ID filtering
* [x] Configurable result limits
* [x] JSON-based database for indexing (`src/lib/database.ts`)

> Note: The original plan called for SQLite FTS5. The implementation uses a JSON database (`data/mcp-analyzer.db.json`) which is simpler and sufficient for the current scale. SQLite could be added later if performance becomes a concern with large datasets.

***

### Phase 6: Polish ✅ LARGELY COMPLETE

* [x] Help system (`src/tools/help.ts`) — contextual guidance for all tools
* [x] ID management tools (`src/tools/id-management.ts`) — session-scoped ID isolation
* [x] Database query tools (`src/tools/query.ts`)
* [x] Interactive setup wizard (`scripts/setup.js`)
* [x] Status checker (`scripts/status.js`)
* [x] Claude Desktop installer (`scripts/install-claude.sh`)
* [ ] Formal test suite (Jest) — only manual smoke tests exist under `test/`
* [ ] npm publication

***

## What's Not Fully Implemented

### Cloud Storage (intentionally deferred)

`src/lib/cloud-storage-adapter.ts` exists with a clean interface but the upload/download methods are stubs with `// TODO` comments. It validates config but does nothing with S3/GCS/Azure. Local storage is the only working mode.

**To implement:** add actual SDK calls (e.g. `@aws-sdk/client-s3`) inside the existing adapter methods. The interface is ready.

***

## Data Flow

```
1. capture_network_requests(url)
      ↓ saves to data/captures/<session>/
      ↓ records captureId in data/mcp-analyzer.db.json

2. analyze_captured_data(captureId)
      ↓ reads captures, groups endpoints, detects auth
      ↓ saves to data/analyses/<analysisId>/
      ↓ records analysisId in db

3. discover_api_patterns(analysisId)
      ↓ REST pattern detection, pagination, data models
      ↓ saves discoveryId to db
      ↓ returns structured JSON ready to use or hand to host agent

4. search_exported_data(query)
      ↓ full-text search across all above files
```

***

## Future Enhancements

* **Cloud storage:** implement real S3/GCS/Azure SDK calls in `cloud-storage-adapter.ts`
* **Formal tests:** set up Jest with test cases for analyzers and pattern matcher
* **GraphQL support:** detect and generate GraphQL queries
* **WebSocket capture:** real-time data streams
* **Scheduling:** automated periodic captures
* **npm publication:** publish as installable package


***

*Last updated: March 16, 2026*
