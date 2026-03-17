# Contributing to MCP Network Analyzer

Thanks for your interest in contributing!

## Development Setup

```bash
# Clone and install (run from monorepo root)
git clone https://github.com/kylebrodeur/mcp-network-analyzer.git
cd mcp-network-analyzer
pnpm install

# Install Playwright browsers
npx playwright install chromium

# Build all packages (core must build before free/pro)
pnpm build:all

# Or build only the free package
cd packages/free
pnpm run build

# Type check
pnpm type-check:all
```

## Repository Structure

This is a pnpm monorepo:

```
packages/
  core/     @mcp-network-analyzer/core — shared lib and tools (private)
  free/     mcp-network-analyzer — stdio transport (this package)
  pro/      mcp-network-analyzer-pro — HTTP transport (private)
```

The `packages/core/src/` directory contains:

- `lib/` — browser automation, network interception, storage, database, analyzer, pattern matcher
- `tools/` — MCP tool implementations (capture, analyze, discover, search, help, id-management, config)

The `packages/free/src/index.ts` entry point imports all tools from `@mcp-network-analyzer/core` and connects them via stdio transport.

## Running Tests

```bash
# From monorepo root
pnpm test

# Or directly
cd packages/free
pnpm run test
```

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes with clear, focused commits
3. Run `pnpm type-check:all` and `pnpm build:all` — both must pass
4. Open a pull request with a clear description of what changed and why

## Reporting Bugs

Open an issue at https://github.com/kylebrodeur/mcp-network-analyzer/issues with:
- Node.js version (`node --version`)
- Steps to reproduce
- Expected vs actual behavior
- Any relevant error output

## Current Limitations

- **Cloud storage is not implemented** in the free package — only local mode works. Cloud support is in the pro package (also not yet fully implemented).
- No formal test runner is configured yet (Jest/Vitest PRs welcome).
