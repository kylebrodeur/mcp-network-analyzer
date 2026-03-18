# MCP Network Analyzer

A Model Context Protocol (MCP) server that provides intelligent network request capture, analysis, and API pattern discovery. Runs locally over stdio — integrates directly with Claude Desktop.

## Features

- **Network Traffic Capture** — Intercept and record HTTP requests/responses from any website using Playwright
- **Intelligent API Discovery** — Automatically identify REST patterns, authentication methods, and data structures
- **Data Search** — Query and search across all captured requests and responses
- **Local Storage** — All data stored on your computer in a configurable directory
- **Data Directory Control** — Set your data directory via CLI (`--data-dir`) or the `set_data_directory` MCP tool at any time

## Requirements

- **Node.js** >= 18
- **Chromium** (installed via Playwright — see Quick Start)
- Linux users may need additional system libraries — see [Playwright Linux deps](https://playwright.dev/docs/browsers#install-system-dependencies)

## Quick Start

### Install from npm

```bash
npm install -g mcp-network-analyzer
npx playwright install chromium
mcp-network-analyzer setup
mcp-network-analyzer install
```

The `install` command detects installed MCP clients (Claude Desktop, VS Code, Claude Code, Gemini CLI, Codex) and installs the server entry interactively.

### Or clone and build from source

```bash
git clone https://github.com/kylebrodeur/mcp-network-analyzer.git
cd mcp-network-analyzer
pnpm install
cd packages/cli
pnpm run build
npx playwright install chromium
pnpm run install-claude
```

## CLI Reference

```bash
# First-time setup — interactive wizard and profile management
mcp-network-analyzer setup
mcp-network-analyzer setup --data-dir /path       # set data directory non-interactively
mcp-network-analyzer setup --show-config           # print current config
mcp-network-analyzer setup --switch <name>         # switch profiles
mcp-network-analyzer setup --list                  # list profiles

# Status check
mcp-network-analyzer status

# Install into an MCP client (interactive client picker)
mcp-network-analyzer install
mcp-network-analyzer install --client claude-desktop   # skip the picker
mcp-network-analyzer install --client vscode           # VS Code user settings
mcp-network-analyzer install --client vscode-workspace # workspace .vscode/mcp.json
mcp-network-analyzer install --client claude-code      # Claude Code CLI (user scope)
mcp-network-analyzer install --client gemini           # Gemini CLI
mcp-network-analyzer install --client codex            # OpenAI Codex

# Reset config / data
mcp-network-analyzer reset
```

## MCP Tools

| Tool | Description |
| --- | --- |
| `capture_network_requests` | Launch browser, capture HTTP traffic from a URL |
| `analyze_captured_data` | Extract REST patterns, auth methods, content types |
| `discover_api_patterns` | Deep pattern analysis — pagination, data models, relationships |
| `search_exported_data` | Full-text search across captured requests and responses |
| `get_server_config` | View current data directory and storage stats |
| `set_data_directory` | Change data directory at runtime (persisted to `.env`) |
| `get_help` | Usage guide and workflow overview |
| `get_next_available_ids` | List recent capture/analysis/discovery IDs |

## Typical Workflow

```
1. capture_network_requests  → Browse to your target URL, record all traffic
2. analyze_captured_data     → Group endpoints, detect auth, summarize
3. discover_api_patterns     → Identify REST patterns, pagination, data models
4. search_exported_data      → Query specific requests or responses
```

## Configuration

Data is stored in `./mcp-network-data/` by default (relative to wherever the server runs). Override with:

```bash
# In .env
MCP_NETWORK_ANALYZER_DATA=/your/custom/path
```

Or at runtime via the `set_data_directory` MCP tool, or:

```bash
pnpm run setup -- --data-dir /your/custom/path
```

## Troubleshooting

**Browser won't launch**
```bash
npx playwright install chromium
# Linux: npx playwright install-deps chromium
```

**Build errors after updating**
```bash
pnpm run clean && pnpm run build
```

**Claude Desktop doesn't show the server**
- Run `mcp-network-analyzer install --client claude-desktop` then fully restart Claude Desktop (quit from system tray)
- Verify the config at `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

**"Cloud storage is not yet implemented"**
- Set `MCP_STORAGE_MODE=local` in `.env` (or remove it — `local` is the default)

## License

MIT — see [LICENSE](LICENSE)
