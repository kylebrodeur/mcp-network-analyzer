# MCP Network Analyzer - Implementation Plan

**Project:** Generic MCP Server for Network Request Analysis & Website Tool Building  
**Created:** November 15, 2025  
**Updated:** November 15, 2025  
**Status:** Phase 1 Complete - Foundation Established

---

## Project Overview

Build a Model Context Protocol (MCP) server that enables LLMs to:
1. Capture network traffic from any website
2. Intelligently analyze API patterns and data structures
3. Automatically generate custom export/scraping tools
4. Query and search captured data

**Key Differentiator:** Generic and reusable, not tied to any specific website or API.

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude)                     │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP Protocol (stdio)
┌────────────────────▼────────────────────────────────────────┐
│                   MCP Network Analyzer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tools Layer                                         │  │
│  │  • capture_network_requests                          │  │
│  │  • analyze_captured_data                             │  │
│  │  • discover_api_patterns                             │  │
│  │  • generate_export_tool                              │  │
│  │  • search_exported_data                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Library Layer                                       │  │
│  │  • Browser Automation (Playwright/Puppeteer)         │  │
│  │  • Network Interceptor                               │  │
│  │  • Pattern Analyzer                                  │  │
│  │  • Code Generator                                    │  │
│  │  • Data Storage & Search                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    [Browser]   [File System]  [Database]
```

### Directory Structure

```
mcp-network-analyzer/
├── src/
│   ├── index.ts                 # MCP server entry point
│   │
│   ├── tools/                   # MCP tool implementations
│   │   ├── capture.ts           # Network capture tool
│   │   ├── analyze.ts           # Basic analysis tool
│   │   ├── discover.ts          # Deep pattern discovery
│   │   ├── generate.ts          # Code generation tool
│   │   └── search.ts            # Data search tool
│   │
│   ├── lib/                     # Core library code
│   │   ├── browser.ts           # Browser automation wrapper
│   │   ├── interceptor.ts       # Network interception logic
│   │   ├── analyzer.ts          # Request/response analyzer
│   │   ├── pattern-matcher.ts   # API pattern recognition
│   │   ├── code-generator.ts    # Export tool generator
│   │   ├── storage.ts           # File/DB operations
│   │   └── types.ts             # TypeScript type definitions
│   │
│   └── templates/               # Code generation templates
│       ├── export-script.ts.hbs # Export script template
│       └── api-client.ts.hbs    # API client template
│
├── dist/                        # Compiled JavaScript
├── data/                        # Runtime data storage
│   ├── captures/                # Captured network data
│   ├── analyses/                # Analysis results
│   └── generated/               # Generated tools
│
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Goal:** MCP server scaffold and basic browser automation

#### Tasks:
- [x] Initialize project with TypeScript and MCP SDK
- [x] Install dependencies (Playwright, Puppeteer, Zod v3.23.8)
- [x] Create directory structure (`src/`, `data/`, `docs/`, `.vscode/`, `.github/`)
- [x] Implement MCP server initialization (`src/index.ts`)
- [x] Register all 5 tool schemas with placeholder handlers
- [x] Configure VS Code workspace (tasks, launch configs, settings)
- [x] Add Copilot instructions and MCP config files
- [x] Implement graceful shutdown and error handling
- [ ] Create basic browser automation wrapper (`src/lib/browser.ts`)
- [ ] Set up stealth configuration (anti-bot detection)
- [ ] Test MCP server connection with Claude Desktop

#### Deliverables:
- ✅ Working MCP server scaffold that compiles and type-checks
- ✅ All five tools registered and callable (return not-implemented placeholder)
- ✅ Structured logging to STDERR (preserves STDOUT for MCP protocol)
- ✅ VS Code integration (build tasks, debugger, formatting)
- ⏳ Browser automation (next step)
- ⏳ End-to-end MCP connection test (next step)

---

### Phase 2: Network Capture Tool (Days 3-4)

**Goal:** Capture and store network requests/responses

#### Tasks:
- [ ] Implement network interceptor (`src/lib/interceptor.ts`)
- [ ] Create capture tool (`src/tools/capture.ts`)
- [ ] Build storage layer for captured data (`src/lib/storage.ts`)
- [ ] Define data schemas using Zod
- [ ] Add filtering options (ignore static assets, focus on API calls)
- [ ] Implement session management (handle auth, cookies)

#### Deliverables:
- `capture_network_requests` MCP tool
- JSON files with captured requests/responses
- Session persistence for authenticated browsing

#### Data Format:
```typescript
interface CapturedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  resourceType: string; // 'xhr', 'fetch', 'document', etc.
}

interface CapturedResponse {
  id: string;
  requestId: string;
  timestamp: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  size: number;
}

interface CaptureSession {
  id: string;
  url: string;
  startTime: string;
  endTime: string;
  requests: CapturedRequest[];
  responses: CapturedResponse[];
}
```

---

### Phase 3: Analysis Tools (Days 5-7)

**Goal:** Intelligent API pattern recognition

#### Tasks:
- [ ] Implement basic analyzer (`src/lib/analyzer.ts`)
- [ ] Create `analyze_captured_data` tool (`src/tools/analyze.ts`)
- [ ] Build pattern matcher (`src/lib/pattern-matcher.ts`)
- [ ] Create `discover_api_patterns` tool (`src/tools/discover.ts`)
- [ ] Add authentication method detection
- [ ] Implement data structure inference

#### Deliverables:
- `analyze_captured_data` - basic endpoint grouping
- `discover_api_patterns` - advanced pattern recognition
- Analysis JSON with structured insights

#### Analysis Features:

**Basic Analysis:**
- Group requests by domain/path patterns
- Identify API vs static resource requests
- Extract authentication headers (cookies, tokens, API keys)
- Detect request/response content types
- Count and categorize status codes

**Pattern Discovery:**
- Identify REST patterns (list endpoints, detail endpoints)
- Detect pagination patterns (page, offset, cursor)
- Recognize search/filter parameters
- Infer data relationships (e.g., threads → messages)
- Suggest optimal data extraction order
- Identify rate limiting headers

**Authentication Analysis:**
- Cookie-based auth
- Bearer tokens
- API keys
- Custom headers
- OAuth flows
- Session management

#### Output Format:
```typescript
interface APIPattern {
  type: 'list' | 'detail' | 'create' | 'update' | 'delete' | 'search';
  method: string;
  pathPattern: string;
  pathParams?: string[];
  queryParams?: string[];
  authMethod: 'cookie' | 'bearer' | 'apikey' | 'custom';
  requiredHeaders: Record<string, string>;
  responseType: 'array' | 'object' | 'paginated';
  dataModel?: InferredDataModel;
  confidence: number;
}

interface InferredDataModel {
  name: string;
  properties: Record<string, {
    type: string;
    required: boolean;
    nested?: InferredDataModel;
  }>;
}

interface AnalysisResult {
  captureId: string;
  timestamp: string;
  summary: {
    totalRequests: number;
    totalResponses: number;
    domains: string[];
    apiEndpoints: number;
  };
  patterns: APIPattern[];
  authHeaders: Record<string, string>;
  recommendations: {
    exportStrategy: string;
    potentialIssues: string[];
    rateLimit?: {
      limit: number;
      window: string;
    };
  };
}
```

---

### Phase 4: Code Generation (Days 8-10)

**Goal:** Automatically generate export tools

#### Tasks:
- [ ] Create template engine (`src/lib/code-generator.ts`)
- [ ] Design export script template (`src/templates/export-script.ts.hbs`)
- [ ] Implement `generate_export_tool` (`src/tools/generate.ts`)
- [ ] Add configurable options (output format, pagination handling)
- [ ] Generate API client code
- [ ] Create error handling and retry logic in templates

#### Deliverables:
- `generate_export_tool` MCP tool
- Generated TypeScript/JavaScript export scripts
- Runnable tools with proper error handling

#### Generated Tool Features:
- **Browser automation** using discovered stealth techniques
- **Authentication** using captured headers/cookies
- **Smart pagination** based on detected patterns
- **Rate limiting** with configurable delays
- **Progress tracking** and resumable exports
- **Data validation** with generated TypeScript types
- **Error recovery** with exponential backoff

#### Template Variables:
```typescript
interface GenerationContext {
  toolName: string;
  targetUrl: string;
  patterns: APIPattern[];
  authConfig: {
    method: string;
    headers: Record<string, string>;
    cookies?: string;
  };
  dataModels: InferredDataModel[];
  exportOptions: {
    outputFormat: 'json' | 'csv' | 'sqlite';
    incremental: boolean;
    parallel: boolean;
  };
}
```

---

### Phase 5: Data Search & Query (Days 11-12)

**Goal:** Make captured data searchable

#### Tasks:
- [ ] Implement data indexing (consider SQLite FTS)
- [ ] Create `search_exported_data` tool (`src/tools/search.ts`)
- [ ] Add filtering by date, domain, status code
- [ ] Implement full-text search on responses
- [ ] Build aggregation queries (count by endpoint, etc.)

#### Deliverables:
- `search_exported_data` MCP tool
- Fast search across captured data
- Aggregation and reporting capabilities

#### Search Capabilities:
- Full-text search on request URLs and response bodies
- Filter by domain, path pattern, status code, date range
- Aggregate by endpoint, response time, size
- Export search results

---

### Phase 6: Polish & Documentation (Days 13-14)

**Goal:** Production-ready server

#### Tasks:
- [ ] Comprehensive error handling
- [ ] Logging and debugging tools
- [ ] Performance optimization
- [ ] Write usage examples
- [ ] Create video/GIF demos
- [ ] Add configuration file support
- [ ] Publish to npm (optional)

#### Deliverables:
- Production-ready MCP server
- Complete documentation with examples
- Installation guide for Claude Desktop
- Example workflows for common use cases

---

## Current State & Next Steps

### ✅ Completed (Phase 1)

**Infrastructure:**
- MCP server entry point (`src/index.ts`) with `McpServer` + `StdioServerTransport`
- Zod schemas for all 5 tools with strict validation
- Placeholder handlers returning "not implemented" responses
- VS Code workspace configuration (tasks, launch, settings, extensions)
- GitHub Copilot instructions and MCP config file
- Data directory structure (`data/captures/`, `data/analyses/`, `data/generated/`)
- Template directory placeholder (`src/templates/`)

**Build & Type Safety:**
- TypeScript strict mode enabled
- `pnpm run build`, `dev`, `type-check`, `clean` scripts functional
- Zod v3.23.8 aligned with MCP SDK types
- Error-free compilation and type checking

### 🚧 In Progress (Phase 1 Completion)

1. **Browser Automation Wrapper** (`src/lib/browser.ts`)
   - Playwright context initialization
   - Stealth configuration (user-agent, viewport, permissions)
   - Page lifecycle management
   - Error handling and cleanup

2. **MCP Connection Test**
   - Build server: `pnpm run build`
   - Test with MCP Inspector: `npx @modelcontextprotocol/inspector node dist/index.js`
   - Verify tool listing and placeholder responses
   - Test with Claude Desktop integration

### ⏭️ Next Steps (Phase 2)

1. **Network Interceptor** (`src/lib/interceptor.ts`)
   - Hook Playwright CDPSession for network events
   - Filter XHR/Fetch requests vs static assets
   - Capture request/response pairs with timing data
   - Handle binary responses and large payloads

2. **Capture Tool Implementation** (`src/tools/capture.ts`)
   - Wire up browser + interceptor
   - Save captured data to `data/captures/{sessionId}/`
   - Implement wait strategies (network idle, custom delays)
   - Session persistence for auth workflows

3. **Storage Layer** (`src/lib/storage.ts`)
   - JSON serialization utilities
   - File system operations with atomic writes
   - Session ID generation and directory management

---

## Technical Decisions

### Browser Engine: Playwright vs Puppeteer

**Decision:** Use **Playwright** as primary, keep Puppeteer as fallback

**Rationale:**
- Playwright has better TypeScript support
- Multi-browser testing capability
- Better network interception API
- More active development
- Puppeteer-extra-stealth available as fallback for tough anti-bot scenarios

### Storage: Files vs Database

**Decision:** **Hybrid approach**
- Captured data → JSON files (human-readable, debuggable)
- Indexed search → SQLite with FTS5 (fast queries)
- Generated tools → TypeScript/JavaScript files

**Rationale:**
- JSON files easy to inspect and share
- SQLite provides fast search without external dependencies
- Generated code needs to be editable by users

### Code Generation: Templates vs AST

**Decision:** **Handlebars templates** for now, AST later if needed

**Rationale:**
- Simpler to implement and maintain
- Easy for users to customize templates
- Sufficient for initial version
- Can migrate to AST manipulation (using ts-morph) if needed

### Authentication Handling

**Decision:** **Capture and replay** approach
- Store auth headers/cookies from capture session
- Inject into generated tools
- User responsible for keeping credentials current

**Rationale:**
- MCP server shouldn't store sensitive credentials long-term
- Simpler than implementing OAuth flows for arbitrary sites
- User controls their own auth tokens

---

## Data Flow Examples

### Example 1: Exporting from a New Website

```
User: "Help me export my data from example.com"

1. capture_network_requests
   Input: { url: "https://example.com", waitForNavigation: true }
   Output: { captureId: "abc123", files: ["requests.json", "responses.json"] }

2. analyze_captured_data
   Input: { captureId: "abc123" }
   Output: { analysisId: "xyz789", endpoints: [...], authHeaders: {...} }

3. discover_api_patterns
   Input: { analysisId: "xyz789" }
   Output: { patterns: [
     { type: "list", path: "/api/items", method: "GET", ... },
     { type: "detail", path: "/api/items/:id", method: "GET", ... }
   ]}

4. generate_export_tool
   Input: { 
     analysisId: "xyz789",
     toolName: "export-example-data",
     outputFormat: "json"
   }
   Output: { 
     scriptPath: "./generated/export-example-data.ts",
     instructions: "Run: npx tsx ./generated/export-example-data.ts"
   }

5. User runs generated script
   Result: Exported data in ./exported-data/
```

### Example 2: Searching Captured Data

```
User: "Find all API calls that returned errors"

search_exported_data
Input: { 
  captureId: "abc123",
  filter: { statusCode: { gte: 400 } }
}
Output: {
  results: [
    { url: "/api/items/999", status: 404, ... },
    { url: "/api/create", status: 403, ... }
  ]
}
```

---

## Success Metrics

### Phase 1-2 Success Criteria:
- [ ] MCP server connects to Claude Desktop
- [ ] Can capture network traffic from any website
- [ ] Captured data saved correctly to JSON files

### Phase 3-4 Success Criteria:
- [ ] Correctly identifies REST API patterns in 80%+ of sites
- [ ] Generates runnable export scripts without manual editing
- [ ] Handles authentication for cookie and bearer token sites

### Phase 5-6 Success Criteria:
- [ ] Search returns results in <100ms for 10K+ requests
- [ ] Generated tools successfully export data from 5+ different websites
- [ ] Clear documentation enables new users to get started in <10 minutes

---

## Testing Strategy

### Unit Tests:
- Pattern matching algorithms
- Data model inference
- Template rendering
- Storage operations

### Integration Tests:
- End-to-end capture → analyze → generate workflow
- Browser automation with real websites
- Generated tool execution

### Manual Testing Sites:
1. **Simple REST API** (e.g., JSONPlaceholder) - baseline
2. **Cookie auth** (e.g., GitHub logged in)
3. **Bearer token** (e.g., API with JWT)
4. **Pagination** (various patterns)
5. **Rate limited** (to test backoff)

---

## Future Enhancements (Post-MVP)

### Advanced Features:
- **GraphQL support** - detect and generate GraphQL queries
- **WebSocket capture** - real-time data streams
- **Form submission** - automated POST/PUT operations
- **Multi-step workflows** - handle complex navigation flows
- **Proxy mode** - run as HTTP proxy instead of browser automation
- **Diff detection** - track changes between captures
- **Scheduling** - automated periodic exports
- **Cloud deployment** - run as a service

### Code Quality:
- Comprehensive test suite (Jest)
- CI/CD pipeline
- Performance benchmarks
- Security audit

### Community:
- Plugin system for custom analyzers
- Template marketplace
- Community-contributed site profiles
- Documentation website

---

## Risk Mitigation

### Risk 1: Anti-bot Detection
**Mitigation:** 
- Use Playwright's stealth mode
- Fallback to Puppeteer-extra-stealth
- Allow manual browser sessions
- Implement delays and randomization

### Risk 2: Complex Authentication
**Mitigation:**
- Start with simple cookie/token auth
- Document manual token extraction process
- Future: OAuth helper tools

### Risk 3: Infinite Variations in APIs
**Mitigation:**
- Focus on common REST patterns (80/20 rule)
- Make templates customizable
- Provide manual override options
- Build pattern recognition incrementally

### Risk 4: Breaking Changes in MCP SDK
**Mitigation:**
- Pin to stable SDK version
- Monitor SDK releases
- Maintain compatibility layer

---

## Getting Started (Developer)

### Setup Development Environment:

```bash
# Clone/navigate to project
cd ~/mcp-network-analyzer

# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# In another terminal, test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

### Development Workflow:

1. Edit source files in `src/`
2. TypeScript compiles automatically (with `--watch`)
3. Test with MCP Inspector or Claude Desktop
4. Iterate quickly with hot reload

### First Implementation Task:

Start with `src/index.ts` - set up the MCP server scaffold:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 1. Create server instance
// 2. Register tools
// 3. Handle requests
// 4. Connect transport
```

---

## Questions to Resolve

### Open Design Questions:

1. **Browser persistence:** Should browser sessions persist between tool calls, or start fresh each time?
   - **Tradeoff:** Persistent = faster, maintains auth BUT more complex state management
   - **Recommendation:** Start stateless, add persistent mode later

2. **Parallelization:** Should generated tools support parallel requests?
   - **Tradeoff:** Faster exports BUT higher risk of rate limiting/blocking
   - **Recommendation:** Make it configurable, default to sequential

3. **Output formats:** JSON, CSV, SQLite - which to prioritize?
   - **Recommendation:** JSON first (most flexible), SQLite for large datasets

4. **Error handling:** How aggressive should retry logic be?
   - **Recommendation:** Exponential backoff with configurable max retries (default 3)

5. **Versioning:** How to handle API changes detected over time?
   - **Recommendation:** Future enhancement - for now, each capture is independent

---

## Resources & References

### MCP Documentation:
- [MCP Specification](https://modelcontextprotocol.io/docs)
- [SDK TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [Example Servers](https://github.com/modelcontextprotocol/servers)

### Browser Automation:
- [Playwright Docs](https://playwright.dev/)
- [Puppeteer Extra Stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)

### Pattern Recognition:
- REST API design patterns
- OpenAPI/Swagger specifications (for reference)

### Similar Projects (Inspiration):
- Postman API capture
- Hoppscotch
- Insomnia HTTP client
- Browser DevTools

---

## Contact & Collaboration

**Project Owner:** kylebrodeur  
**Repository:** (TBD - will be created after MVP)  
**Status:** Active Development  
**Last Updated:** November 15, 2025

---

*This plan is a living document. Update as implementation progresses and requirements evolve.*
