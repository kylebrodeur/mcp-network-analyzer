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
netcap setup
netcap install
```

> `netcap` is the short alias for `mcp-network-analyzer` — both are installed and work identically.

The `install` command detects installed MCP clients (Claude Desktop, VS Code, Claude Code, Gemini CLI, Codex) and installs the server entry interactively.

### Or clone and build from source

```bash
git clone https://github.com/kylebrodeur/mcp-network-analyzer.git
cd mcp-network-analyzer
pnpm install
pnpm --filter mcp-network-analyzer build
cd packages/cli
pnpm link --global
netcap setup
netcap install --client claude-desktop
```

## CLI Reference

```bash
# First-time setup — interactive wizard and profile management
netcap setup
netcap setup --data-dir /path       # set data directory non-interactively
netcap setup --show-config           # print current config
netcap setup --switch <name>         # switch profiles
netcap setup --list                  # list profiles
netcap setup --reset                 # clear .env/profiles, then re-run setup
netcap setup --install-chromium      # install/reinstall Playwright Chromium

# Status check
netcap status

# Install into an MCP client (interactive client picker)
netcap install
netcap install --client claude-desktop   # skip the picker
netcap install --client vscode           # VS Code user settings
netcap install --client vscode-workspace # workspace .vscode/mcp.json
netcap install --client claude-code      # Claude Code CLI (user scope)
netcap install --client gemini           # Gemini CLI
netcap install --client codex            # OpenAI Codex

# Reset config / data
netcap reset

# Serve mode
netcap serve                         # stdio (default)
netcap serve --mode stdio            # force stdio
netcap serve --mode http             # HTTP mode (requires pro package)
```

> `mcp-network-analyzer` is also available as a full-length alias.

## MCP Tools

| Tool | Description |
| --- | --- |
| `capture_network_requests` | Launch browser, capture HTTP traffic from a URL |
| `analyze_captured_data` | Extract REST patterns, auth methods, content types |
| `discover_api_patterns` | Deep pattern analysis — pagination, data models, relationships |
| `search_exported_data` | Full-text search across captured requests and responses |
| `list_analyses` | Query stored analyses with optional filters |
| `list_discoveries` | Query stored discoveries with optional filters |
| `get_database_stats` | Get aggregate database statistics |
| `get_server_config` | View current data directory and storage stats |
| `set_data_directory` | Change data directory at runtime (persisted to `.env`) |
| `get_help` | Usage guide and workflow overview |
| `list_session_ids` | List captures, analyses, and discoveries for one session |
| `get_next_session_ids` | List IDs in one session that are ready for the next phase |

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
netcap setup --install-chromium
# Linux: npx playwright install-deps chromium
```

**Build errors after updating**
```bash
pnpm run clean && pnpm run build
```

**Claude Desktop doesn't show the server**
- Run `netcap install --client claude-desktop` then fully restart Claude Desktop (quit from system tray)
- Verify the config at `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

**"Cloud storage is not yet implemented"**
- Set `MCP_STORAGE_MODE=local` in `.env` (or remove it — `local` is the default)

## License

MIT — see [LICENSE](LICENSE)
