# CLI Architecture

## Goal

Expose MCP Network Analyzer as a proper installed CLI so users get a first-class, non-ephemeral setup experience, and Claude Desktop gets a stable, persistent server reference.

## Current State

The setup, status, and install-claude scripts live inside `packages/cli/scripts/` and are only accessible via internal pnpm scripts (`pr setup`, `pr status`, `pr install-claude`). They are not part of the published surface area and require users to be inside the repo to run them.

## Target State

The published package exposes a single `mcp-network-analyzer` binary. Users install it once, globally or in a dedicated folder, and interact with it through a stable CLI.

```
npm install -g mcp-network-analyzer
# or
npm install mcp-network-analyzer  (in a dedicated ~/mcp-tools folder)
```

Then use it:

```
mcp-network-analyzer setup          # onboarding wizard
mcp-network-analyzer status         # health check
mcp-network-analyzer install-claude # write Claude Desktop config
mcp-network-analyzer reset          # clear config and/or data (with confirmation)
mcp-network-analyzer serve          # start MCP stdio server (used by Claude at runtime)
```

Running `mcp-network-analyzer` with no arguments shows status if already configured, or runs setup if it is a first run.

## Package Changes Required

**`packages/cli/src/cli.ts`** — new CLI entrypoint. Parses the first argument as a subcommand and delegates to the existing logic extracted from `scripts/`.

**`packages/cli/package.json`** — add `bin` mapping pointing to the compiled CLI entrypoint:

```json
"bin": {
  "mcp-network-analyzer": "dist/cli.js"
}
```

**`packages/cli/scripts/`** — refactored into thin wrappers that call the same shared modules so `pr setup` etc. keep working during development.

## Claude Desktop Config

The `install-claude` command writes the Claude Desktop config with an absolute reference to the installed package entry, not a transient `npx` call:

```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/path/to/installed/node_modules/mcp-network-analyzer/dist/index.js"]
    }
  }
}
```

Using `node` + absolute path instead of the bin name avoids PATH resolution issues in GUI apps like Claude Desktop on macOS, where `PATH` is often minimal.

## Reset Command

The `reset` subcommand handles these destructive operations with explicit confirmation prompts:

1. Clear `.env` and profile data (always offered)
2. Optionally delete the data directory contents (capture/analysis files)
3. Remove the Claude Desktop MCP server entry (optional)

No data is deleted without explicit `y` confirmation. A `--force` flag is available for scripted use.

## Backward Compatibility

The existing `pr setup`, `pr status`, `pr install-claude` scripts remain functional during development. They are kept as thin delegates to the same underlying modules. The dist CLI is the only surface that ships in the published package.
