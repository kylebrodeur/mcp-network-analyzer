# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-15

### Added
- `netcap` short binary alias — installed alongside `mcp-network-analyzer`, both point to the same entry point
- `setup --reset` (`-r`) — clears `.env` and saved profiles, then re-runs the setup wizard
- `setup --install-chromium` — first-class CLI/TUI recovery command to install/reinstall Playwright Chromium
- Free CLI now includes database query tools: `list_analyses`, `list_discoveries`, and `get_database_stats`
- `install` command — detects installed MCP clients (Claude Desktop, VS Code, Claude Code, Gemini CLI, OpenAI Codex) and installs the server entry via the client's native interface or direct config write
- `--client <id>` flag for non-interactive / CI installs
- Unified core CLI runner (`createCli` + `CliExtension`) — free and pro share one CLI engine; package-specific commands (setup, serve) are registered as extensions

### Changed
- `serve` now accepts `--mode auto|stdio|http`; auto remains stdio-first and can resolve to pro HTTP when `MCP_TRANSPORT=http`

### Removed
- Legacy one-off client installer command — superseded by `install --client <id>`

## [0.2.0] - 2026-03-18

### Added
- Published CLI (`mcp-network-analyzer`) — `setup`, `status`, `install`, `reset`, `serve` subcommands
- Default behaviour: runs `status` when configured, `setup` when not
- `reset` command with `--config`, `--data`, `--claude`, `--force` flags
- Profile management via `setup --switch`, `setup --list`, `setup --show-config`
- `exports` field for proper ESM module resolution

### Changed
- Build switched from `tsc` to `tsup` — bundles internal core, keeps the published package self-contained
- Moved `@mcp-network-analyzer/core` to devDependencies (bundled at build time, not a runtime install)
- Added `playwright` as a direct runtime dependency
- Quick Start now shows `npm install -g mcp-network-analyzer` path

## [Unreleased]

### Changed

- Monorepo split: free (stdio/local) and pro (HTTP/cloud) are now separate packages
- Shared library and tools moved to `@mcp-network-analyzer/core` workspace package


## [0.1.0] - 2024-11-15

### Added
- `capture_network_requests` tool — Playwright-based browser automation for intercepting HTTP traffic
- `analyze_captured_data` tool — REST pattern detection, authentication discovery, content-type analysis
- `discover_api_patterns` tool — Deep pattern recognition with confidence scoring, pagination detection, data model extraction
- `search_exported_data` tool — Full-text search across all captured requests and responses
- `get_server_config` / `set_data_directory` tools — inspect and change data directory at runtime
- `get_help` / `get_next_available_ids` tools — workflow guidance and ID management
- Local file storage with JSON database (`data/` directory)
- Stdio transport for Claude Desktop integration
- Interactive setup wizard (`pnpm run setup`) with profile switching and `--data-dir` / `--show-config` flags
- Client installation flow (`netcap install --client claude-desktop`)
- Status checker (`pnpm run status`)
- Stealth browser mode to avoid bot detection
