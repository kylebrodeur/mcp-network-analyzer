# Local Testing Guide

## 1. Build Everything

```bash
# From monorepo root — builds core → cli → pro in order
pnpm run build:all

# Or build individually
pnpm --filter @mcp-network-analyzer/core build
pnpm --filter mcp-network-analyzer build
pnpm --filter mcp-network-analyzer-pro build
```

## 2. Type-Check

```bash
pnpm run type-check:all
```

## 3. Smoke Test the CLI (no install)

```bash
node packages/cli/dist/cli.js --version
node packages/cli/dist/cli.js --help
node packages/cli/dist/cli.js status
```

Expected behavior checks:
- `--version` prints only the version and exits (no server startup logs).
- `--help` prints command help and exits.

Setup/browser check:

```bash
node packages/cli/dist/cli.js setup
```

During setup, Chromium is installed automatically via Playwright. If browser install fails in your environment, run this fallback once:

```bash
netcap setup --install-chromium
```

## 4. Local Install via pnpm link (recommended for iterative testing)

```bash
# Important: run link from packages/cli (not monorepo root)
# Linking from root links the workspace package (no binaries)
# and can pull stale global link entries.
cd packages/cli
pnpm link --global

# Now use the real binary from anywhere (netcap and mcp-network-analyzer are identical):
netcap --version
netcap --help
netcap setup
netcap status
netcap install
netcap install --client claude-desktop
netcap install --client vscode
netcap install --client vscode-workspace
netcap install --client claude-code
netcap install --client gemini
netcap install --client codex
netcap serve   # starts the stdio MCP server
netcap reset

# Unlink when done
pnpm unlink --global mcp-network-analyzer
```

After each rebuild, the linked binary picks up the new `dist/` automatically.

## 5. Tarball Install (closest to real npm install)

```bash
cd packages/cli
npm pack
# produces mcp-network-analyzer-0.3.0.tgz

# Install globally from the tarball
npm install -g ./mcp-network-analyzer-0.3.0.tgz

# Test (both aliases are installed)
netcap --version
netcap --help
mcp-network-analyzer --version  # full alias also works

# Uninstall when done
npm uninstall -g mcp-network-analyzer
```

## 6. Test the Pro Package

```bash
# Run directly (no global install needed)
node packages/pro/dist/cli.js --version
node packages/pro/dist/cli.js --help
node packages/pro/dist/cli.js setup
node packages/pro/dist/cli.js serve   # starts the HTTP MCP server
```

## 7. MCP Server Integration Test (stdio)

Point an MCP client at the local build directly. Example VS Code `mcp.json`:

```json
{
  "servers": {
    "network-analyzer-local": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/kylebrodeur/workspace/mcp-network-analyzer/packages/cli/dist/index.js"]
    }
  }
}
```

Or use the `install` command with `MCP_CLI_PROJECT_ROOT` set to point at the local build:

```bash
MCP_CLI_PROJECT_ROOT=/Users/kylebrodeur/workspace/mcp-network-analyzer/packages/cli \
  node packages/cli/dist/cli.js install
```

## 8. Full Clean Rebuild

```bash
pnpm run clean:all && pnpm run build:all
```
