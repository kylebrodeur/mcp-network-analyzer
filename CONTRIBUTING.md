# Contributing

Thanks for contributing to MCP Network Analyzer.

## Development Setup

1. Install dependencies:
   - `pnpm install`
2. Build all packages:
   - `pnpm build:all`
3. Type-check all packages:
   - `pnpm type-check:all`

## Monorepo Structure

- `packages/core`: shared MCP tools, storage, and server utilities
- `packages/cli`: published CLI package (`mcp-network-analyzer`, alias `netcap`)
- `packages/pro`: HTTP/cloud-oriented package

## Pull Request Checklist

- [ ] Include focused changes with clear commit messages
- [ ] Run `pnpm type-check:all`
- [ ] Run `pnpm build:all`
- [ ] Update docs (`README.md`, `docs/`) if behavior changes
- [ ] Add or update tests for non-trivial logic changes

## Code Guidelines

- Keep TypeScript strict-mode friendly
- Prefer async/await with contextual error handling
- Avoid writing logs to STDOUT in MCP runtime paths
- Keep generated artifacts under `mcp-network-data/` or `data/` as appropriate

For package-specific guidance, also see `packages/cli/CONTRIBUTING.md`.
