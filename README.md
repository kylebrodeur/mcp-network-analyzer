# MCP Network Analyzer Monorepo

MCP Network Analyzer captures browser network traffic, analyzes API patterns, and exposes the workflow through an MCP server for AI clients.

[CLI package (npm)](https://www.npmjs.com/package/mcp-network-analyzer) | [Issues](https://github.com/kylebrodeur/mcp-network-analyzer/issues) | [Security](https://github.com/kylebrodeur/mcp-network-analyzer/security)

Short command: `netcap`  
Full command: `mcp-network-analyzer`

## Why This Project

- Capture real browser traffic with Playwright-backed sessions
- Discover API endpoints, auth patterns, and request/response shapes
- Expose analysis tools through MCP for AI-assisted workflows
- Run locally with a focused CLI and straightforward setup

## Quick Install (Published CLI)

```bash
pnpm add -g mcp-network-analyzer
netcap setup
netcap install
netcap status
```

For local development and workspace setup, continue below.

## Packages

| Package | Description | Published |
| --- | --- | --- |
| [`packages/cli`](packages/cli) | `mcp-network-analyzer` / `netcap` — stdio transport, local storage | npm / GitHub |
| [`packages/pro`](packages/pro) | `mcp-network-analyzer-pro` — HTTP transport, cloud storage | private |
| [`packages/core`](packages/core) | `@mcp-network-analyzer/core` — shared lib and tools | workspace-only |

## Getting Started

```bash
pnpm install
pnpm build:all
pnpm type-check:all
```

## CLI Version (stdio)

See [`packages/cli/README.md`](packages/cli/README.md) for installation and usage.

Quick start:

```bash
cd packages/cli
pnpm run build
pnpm link --global
netcap setup
netcap install
```

`netcap` is the short alias for `mcp-network-analyzer`.

## Pro Version (HTTP)

See [`packages/pro/README.md`](packages/pro/README.md) for server deployment.

```bash
cd packages/pro
pnpm run setup
pnpm run dev     # development mode
pnpm run start   # production
```

## Development

```bash
pnpm install           # link workspace packages
pnpm build:all         # build in dependency order
pnpm type-check:all    # check types across all packages
pnpm clean:all         # remove all dist/ directories
```

## Testing

Local testing instructions are in [docs/TESTING.md](docs/TESTING.md).

## Release

Public launch checklist is in [docs/PUBLIC_RELEASE_STEPS.md](docs/PUBLIC_RELEASE_STEPS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and pull request expectations.

## License

MIT — see [LICENSE](LICENSE)
