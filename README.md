# mcp-network-analyzer — Monorepo

This repository contains the MCP Network Analyzer packages.

## Packages

| Package | Description | Published |
| --- | --- | --- |
| [`packages/cli`](packages/cli) | `mcp-network-analyzer` — stdio transport, local storage | npm / GitHub |
| [`packages/pro`](packages/pro) | `mcp-network-analyzer-pro` — HTTP transport, cloud storage | private |
| [`packages/core`](packages/core) | `@mcp-network-analyzer/core` — shared lib and tools | workspace-only |

## Getting Started

```bash
# Install all workspace dependencies
pnpm install

# Build all packages (core → cli → pro)
pnpm build:all

# Type-check all packages
pnpm type-check:all
```

## CLI Version (stdio)

See [`packages/cli/README.md`](packages/cli/README.md) for installation and usage.

Quick start:

```bash
cd packages/cli
pnpm run build
mcp-network-analyzer setup
mcp-network-analyzer install
```

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

## License

MIT — see [`packages/cli/LICENSE`](packages/cli/LICENSE)
