# Technical Decisions & Testing Strategy

> **Archived from PLAN.md** — Pre-implementation design rationale.
> Actual implementation may differ. See PROJECT_STATUS.md for current state.

---

## Technical Decisions

### Browser Engine

**Decision:** Use **Playwright** only (Puppeteer removed)

**Rationale:**
* Playwright has better TypeScript support
* Multi-browser testing capability
* Better network interception API
* More active development
* Stealth mode available via custom `extraHTTPHeaders` and `args`

### Storage: Files vs Database

**Decision:** **JSON files** for captured data (SQLite FTS not implemented)

**Rationale:**
* JSON files easy to inspect and share
* SQLite provides fast search without external dependencies (planned, not built)
* Generated tools → TypeScript/JavaScript files under `data/generated/`

> Note: SQLite FTS was planned but not implemented. Storage is JSON-based (`data/mcp-analyzer.db.json`).

### Code Generation: Templates vs LLM

**Decision:** **Ollama LLM** (default: `qwen2.5-coder:7b`) with Handlebars template fallback

**Rationale:**
* LLM produces more contextually relevant code than static templates
* Handlebars templates serve as fallback when no LLM available
* `LLM_PROVIDER=huggingface` switches to HuggingFace Inference API

> Note: HuggingFace/Nebius were explored but Ollama local inference is now the default.

### Authentication Handling

**Decision:** **Capture and replay** approach
* Store auth headers/cookies from capture session
* Inject into generated tools
* User responsible for keeping credentials current

**Rationale:**
* MCP server shouldn't store sensitive credentials long-term
* Simpler than implementing OAuth flows for arbitrary sites
* User controls their own auth tokens

---

## Testing Strategy

> These were the planned test categories pre-implementation. No formal test suite exists yet.
> See "What's Not Done" in PROJECT_STATUS.md.

### Unit Tests (Planned)
* Pattern matching algorithms
* Data model inference
* Template rendering
* Storage operations

### Integration Tests (Planned)
* End-to-end capture → analyze → generate workflow
* Browser automation with real websites
* Generated tool execution

### Manual Testing Sites
1. **Simple REST API** (e.g., JSONPlaceholder) — baseline
2. **Cookie auth** (e.g., GitHub logged in)
3. **Bearer token** (e.g., API with JWT)
4. **Pagination** (various patterns)
5. **Rate limited** (to test backoff)

---

*Archived: January 2025*
