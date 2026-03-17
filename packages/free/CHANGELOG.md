# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Installation helper for Claude Desktop (`pnpm run install-claude`)
- Status checker (`pnpm run status`)
- Stealth browser mode to avoid bot detection
