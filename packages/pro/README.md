# mcp-network-analyzer-pro

HTTP/hosted version of the MCP Network Analyzer. Runs as a persistent HTTP server using the Streamable HTTP transport, making it suitable for cloud deployment and shared team access.

## Features

- All features from the free version
- HTTP/Streamable HTTP transport (accessible over network)
- `list_analyses`, `list_discoveries`, `get_database_stats` query tools
- Full setup wizard including cloud storage and remote server options

## Development

```bash
pnpm install
pnpm run dev        # tsx watch mode
pnpm run build      # compile to dist/
pnpm run setup      # run setup wizard
pnpm run status     # check configuration
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `HOST` | `0.0.0.0` | HTTP bind address |
| `MCP_STORAGE_MODE` | `local` | `local` or `cloud` |
| `MCP_NETWORK_ANALYZER_DATA` | `./data` | Local data directory |

## Endpoints

- `POST /mcp` — MCP Streamable HTTP endpoint
- `GET /health` — Health check
