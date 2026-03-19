# CLI Architecture

## Goal

Expose MCP Network Analyzer as a proper installed CLI so users get a first-class, non-ephemeral setup experience, and Claude Desktop gets a stable, persistent server reference.

## Current State

The CLI is exposed through a single published binary and command family (`netcap` / `mcp-network-analyzer`). Setup, status, install, reset, and serve are available from the installed package.

## Target State

The published package exposes two bin aliases: `netcap` (short form) and `mcp-network-analyzer` (full form). Both point to the same entry point. Users install once, globally or in a dedicated folder.

```
npm install -g mcp-network-analyzer
```

Then use either alias interchangeably:

```
netcap setup          # onboarding wizard
netcap status         # health check
netcap install        # install into a detected MCP client
netcap install --client claude-desktop
netcap reset          # clear config and/or data (with confirmation)
netcap serve          # start MCP stdio server (used by Claude at runtime)
```

Running `netcap` with no arguments shows status if already configured, or runs setup if it is a first run.

## Package Changes Required

**`packages/cli/src/cli.ts`** — new CLI entrypoint. Parses the first argument as a subcommand and delegates to the existing logic extracted from `scripts/`.

**`packages/cli/package.json`** — `bin` mapping with both aliases:

```json
"bin": {
  "mcp-network-analyzer": "dist/cli.js",
  "netcap": "dist/cli.js"
}
```

**`packages/cli/scripts/`** — refactored into thin wrappers that call the same shared modules so `pr setup` etc. keep working during development.

## Claude Desktop Config

The `install --client claude-desktop` command writes the Claude Desktop config with an absolute reference to the installed package entry, not a transient `npx` call:

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

The existing `pr setup` and `pr status` scripts remain functional during development as wrappers over the same command modules. The dist CLI is the only surface that ships in the published package.
